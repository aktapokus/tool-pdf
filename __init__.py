"""
tools/pdf/__init__.py
PDF Aracı — public API (motor katmanı, HTTP'den bağımsız).

Üç ayrı iş grubu:
1. Sayfa işlemleri (birleştir/böl/döndür/sil/yeniden sırala) + PDF<->görsel
   + düz metne çevirme — hepsi PyMuPDF (fitz) ile, harici süreç yok.
2. Office<->PDF dönüşümü (docx/xlsx/pptx <-> pdf) — sistemde kurulu
   LibreOffice'in (`soffice --headless`) subprocess ile çağrılması. pip ile
   kurulamayan tek bağımlılık bu; core/Dockerfile'a eklendi (AGENTS.md
   Madde 6 — additive, sadece bu tool'u etkiler, LibreOffice yoksa/başarısız
   olursa sadece bu iki fonksiyon RuntimeError fırlatır, core çökmez).
3. Metin satırı çıkarma/düzenleme — hem "Metni Düzenle" sekmesinin manuel
   akışı hem de "AI ile Düzenle" sekmesinin (web.py: web_analyze/execute)
   ortak temeli. Watermark EKLEMEZ — bu tool'un çıktısı hep temiz PDF'tir
   (kullanıcının "watermarksız" isteği v0.1'in tasarım ilkesi, ayrı bir
   bayrak/parametre gerektirmiyor çünkü zaten hiçbir yerde watermark
   basılmıyor).
"""

from __future__ import annotations

import base64
import concurrent.futures
import io
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

import fitz  # PyMuPDF
from pypdf import PdfReader, PdfWriter

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

OTURUM_DIR = DATA_DIR / "oturumlar"
OTURUM_DIR.mkdir(parents=True, exist_ok=True)

OTURUM_MAKS_YAS_SAAT = 24

# Office<->PDF dönüşümünde soffice'in kabul ettiği hedef uzantılar — UI bu
# listeyle sınırlı seçenek sunar, keyfi bir uzantı subprocess'e geçmez.
OFFICE_TO_PDF_UZANTILARI = {".docx", ".doc", ".odt", ".xlsx", ".xls", ".ods", ".pptx", ".ppt", ".odp", ".rtf", ".txt"}
# PDF -> Office LibreOffice ile YAPILMIYOR (bkz. pdf_to_office docstring'i)
# — bu yüzden hedef format seçenekleri, gerçekten uygulanmış olan
# _pdf_to_docx/_pdf_to_xlsx/_pdf_to_pptx ile sınırlı.
PDF_TO_OFFICE_HEDEFLERI = {"docx", "xlsx", "pptx"}


class PdfAraciHatasi(RuntimeError):
    """Kullanıcıya doğrudan gösterilebilecek, beklenen hata sınıfı
    (bozuk PDF, desteklenmeyen format, soffice bulunamadı vb.)."""
    pass


# ── Oturum deposu ────────────────────────────────────────────────────────
# Her yüklenen PDF bir oturum_id alır; "{id}.pdf" o oturumun GÜNCEL hâli
# (her düzenleme bunu üzerine yazar — ardışık işlemler zincirlenebilsin
# diye), "{id}_orijinal.pdf" ilk yüklenen, hiç değişmeyen kopya (Sıfırla /
# web_rollback bu kopyaya döner).
def _oturum_yolu(oturum_id: str) -> Path:
    return OTURUM_DIR / f"{oturum_id}.pdf"


def _oturum_orijinal_yolu(oturum_id: str) -> Path:
    return OTURUM_DIR / f"{oturum_id}_orijinal.pdf"


def _eski_oturumlari_temizle(maks_yas_saat: int = OTURUM_MAKS_YAS_SAAT) -> None:
    simdi = time.time()
    for p in OTURUM_DIR.glob("*.pdf"):
        try:
            if simdi - p.stat().st_mtime > maks_yas_saat * 3600:
                p.unlink(missing_ok=True)
        except OSError:
            continue


def oturum_yukle(data: bytes) -> tuple[str, int]:
    _eski_oturumlari_temizle()
    _pdf_dogrula(data)
    oturum_id = str(uuid.uuid4())
    _oturum_yolu(oturum_id).write_bytes(data)
    _oturum_orijinal_yolu(oturum_id).write_bytes(data)
    return oturum_id, sayfa_sayisi(data)


def oturum_oku(oturum_id: str) -> bytes | None:
    p = _oturum_yolu(oturum_id)
    return p.read_bytes() if p.exists() else None


# Geri Al / İleri Al (undo/redo) — her oturum için bellek-içi bir yığın.
# Basit tutuluyor (dosya sistemine değil belleğe): oturumlar zaten geçici
# (24 saatte otomatik temizleniyor), process yeniden başlarsa yarım kalan
# bir düzenleme geçmişi de zaten anlamını yitirir. Derinlik sınırlı (20)
# ki çok sayıda düzenleme yapan bir oturum belleği şişirmesin.
_UNDO_GECMISI: dict[str, list[bytes]] = {}
_REDO_GECMISI: dict[str, list[bytes]] = {}
_GECMIS_MAKS_DERINLIK = 20


def oturum_yaz(oturum_id: str, data: bytes) -> None:
    onceki = oturum_oku(oturum_id)
    if onceki is not None and onceki != data:
        yigin = _UNDO_GECMISI.setdefault(oturum_id, [])
        yigin.append(onceki)
        del yigin[:-_GECMIS_MAKS_DERINLIK]
        _REDO_GECMISI.pop(oturum_id, None)  # yeni bir değişiklik yapıldı, eski "ileri al" dalı geçersiz
    _oturum_yolu(oturum_id).write_bytes(data)


def oturum_geri_alinabilir_mi(oturum_id: str) -> bool:
    return bool(_UNDO_GECMISI.get(oturum_id))


def oturum_ileri_alinabilir_mi(oturum_id: str) -> bool:
    return bool(_REDO_GECMISI.get(oturum_id))


def oturum_geri_al(oturum_id: str) -> bytes | None:
    yigin = _UNDO_GECMISI.get(oturum_id)
    if not yigin:
        return None
    mevcut = oturum_oku(oturum_id)
    onceki = yigin.pop()
    if mevcut is not None:
        _REDO_GECMISI.setdefault(oturum_id, []).append(mevcut)
    _oturum_yolu(oturum_id).write_bytes(onceki)
    return onceki


def oturum_ileri_al(oturum_id: str) -> bytes | None:
    yigin = _REDO_GECMISI.get(oturum_id)
    if not yigin:
        return None
    mevcut = oturum_oku(oturum_id)
    sonraki = yigin.pop()
    if mevcut is not None:
        _UNDO_GECMISI.setdefault(oturum_id, []).append(mevcut)
    _oturum_yolu(oturum_id).write_bytes(sonraki)
    return sonraki


def oturum_sifirla(oturum_id: str) -> bytes | None:
    orijinal = _oturum_orijinal_yolu(oturum_id)
    if not orijinal.exists():
        return None
    data = orijinal.read_bytes()
    _oturum_yolu(oturum_id).write_bytes(data)
    _UNDO_GECMISI.pop(oturum_id, None)
    _REDO_GECMISI.pop(oturum_id, None)
    return data


def oturum_sil(oturum_id: str) -> None:
    _oturum_yolu(oturum_id).unlink(missing_ok=True)
    _oturum_orijinal_yolu(oturum_id).unlink(missing_ok=True)
    _UNDO_GECMISI.pop(oturum_id, None)
    _REDO_GECMISI.pop(oturum_id, None)


def _pdf_dogrula(data: bytes) -> None:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        n = len(doc)
        doc.close()
    except Exception as e:
        raise PdfAraciHatasi(f"Geçersiz veya bozuk PDF dosyası: {e}")
    if n == 0:
        raise PdfAraciHatasi("PDF'te hiç sayfa yok.")


def _hex_to_rgb(hexstr: str) -> tuple[float, float, float]:
    h = (hexstr or "#000000").lstrip("#")
    if len(h) != 6:
        h = "000000"
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# PyMuPDF'in taban-14 Helvetica takma adı ("helv"/"hebo", WinAnsi kodlamalı)
# Türkçe'ye özgü harfleri (ı/ğ/ş/İ/Ğ/Ş) İÇERMİYOR — gerçek build'de
# doğrulandı: "ğışöüĞİŞÖÜÇ" yazınca "ðýþöüÐÝÞÖÜÇ" gibi yanlış Latin-1
# glifleri basılıyordu (Latin-5/Türkçe ile Latin-1 kodlama karışıklığı).
# Bunun yerine core image'ında zaten kurulu olan (weasyprint için eklenen,
# core/Dockerfile) Liberation Sans TTF'i gömülü font olarak kullanıyoruz —
# Latin Extended-A'yı (dolayısıyla Türkçe'yi) doğrulanmış şekilde kapsıyor.
_LIBERATION_REGULAR = Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf")
_LIBERATION_BOLD = Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf")


def _metin_font_kwargs(kalin: bool) -> dict:
    """fitz'in insert_text'ine geçirilecek font argümanları. Liberation
    Sans dosyası bulunamazsa (ör. farklı bir geliştirme ortamı) sessizce
    taban-14 fonta düşülür — hata vermez, ama Türkçe karakterler bozuk
    kalır (bilinçli, kontrollü bozulma — bkz. yukarıdaki not)."""
    yol = _LIBERATION_BOLD if kalin else _LIBERATION_REGULAR
    if yol.exists():
        return {"fontfile": str(yol), "fontname": "LiberationSans-Bold" if kalin else "LiberationSans"}
    return {"fontname": "hebo" if kalin else "helv"}


# ── Sayfa işlemleri ──────────────────────────────────────────────────────
def sayfa_sayisi(data: bytes) -> int:
    doc = fitz.open(stream=data, filetype="pdf")
    n = len(doc)
    doc.close()
    return n


def sayfa_olculeri(data: bytes, sayfa_no: int) -> tuple[float, float]:
    """Bir sayfanın nokta (PDF unit) cinsinden genişlik/yükseklik'i —
    damga ekleme sekmesinde önizleme görselindeki tıklama koordinatını
    gerçek PDF koordinatına çevirmek için (fitz'in koordinat sistemi
    hem render hem insert_text için sol-üst orijinli, y aşağı doğru
    artıyor — ayrıca bir dönüşüm/flip gerekmiyor)."""
    doc = fitz.open(stream=data, filetype="pdf")
    if sayfa_no < 0 or sayfa_no >= len(doc):
        doc.close()
        raise PdfAraciHatasi(f"Geçersiz sayfa numarası: {sayfa_no}")
    r = doc[sayfa_no].rect
    doc.close()
    return (r.width, r.height)


def kucuk_resim_uret(data: bytes, sayfa_no: int, max_kenar: int = 220) -> bytes:
    doc = fitz.open(stream=data, filetype="pdf")
    if sayfa_no < 0 or sayfa_no >= len(doc):
        doc.close()
        raise PdfAraciHatasi(f"Geçersiz sayfa numarası: {sayfa_no}")
    page = doc[sayfa_no]
    oran = max_kenar / max(page.rect.width, page.rect.height, 1)
    pix = page.get_pixmap(matrix=fitz.Matrix(oran, oran))
    png = pix.tobytes("png")
    doc.close()
    return png


def sayfalari_birlestir(dosyalar: list[bytes]) -> bytes:
    if len(dosyalar) < 2:
        raise PdfAraciHatasi("Birleştirmek için en az 2 PDF gerekli.")
    out = fitz.open()
    for data in dosyalar:
        _pdf_dogrula(data)
        with fitz.open(stream=data, filetype="pdf") as d:
            out.insert_pdf(d)
    b = out.tobytes()
    out.close()
    return b


def sayfalari_uygula(data: bytes, plan: list[dict]) -> bytes:
    """plan: [{"index": int (0-tabanlı orijinal sayfa no), "dondur": int}]
    — listedeki SIRA son PDF'in sayfa sırasıdır; listede olmayan orijinal
    sayfalar silinmiş sayılır (birleşik sayfa sil/sırala/döndür arayüzü)."""
    src = fitz.open(stream=data, filetype="pdf")
    if not plan:
        src.close()
        raise PdfAraciHatasi("Sonuçta en az bir sayfa kalmalı.")
    out = fitz.open()
    for adim in plan:
        idx = int(adim["index"])
        if idx < 0 or idx >= len(src):
            continue
        out.insert_pdf(src, from_page=idx, to_page=idx)
        dondur = int(adim.get("dondur", 0)) % 360
        if dondur:
            yeni_sayfa = out[-1]
            yeni_sayfa.set_rotation((yeni_sayfa.rotation + dondur) % 360)
    src.close()
    if len(out) == 0:
        out.close()
        raise PdfAraciHatasi("Sonuçta en az bir sayfa kalmalı.")
    b = out.tobytes()
    out.close()
    return b


def pdf_bol(data: bytes, araliklar: list[tuple[int, int]]) -> list[tuple[str, bytes]]:
    """araliklar: [(bas0, bit0)] — 0-tabanlı, dahil-dahil."""
    src = fitz.open(stream=data, filetype="pdf")
    n = len(src)
    sonuc = []
    for i, (bas, bit) in enumerate(araliklar, start=1):
        bas = max(0, min(bas, n - 1))
        bit = max(bas, min(bit, n - 1))
        out = fitz.open()
        out.insert_pdf(src, from_page=bas, to_page=bit)
        sonuc.append((f"parca_{i}_s{bas+1}-{bit+1}.pdf", out.tobytes()))
        out.close()
    src.close()
    if not sonuc:
        raise PdfAraciHatasi("Geçerli bir bölme aralığı bulunamadı.")
    return sonuc


def pdf_her_sayfayi_ayir(data: bytes) -> list[tuple[str, bytes]]:
    n = sayfa_sayisi(data)
    return pdf_bol(data, [(i, i) for i in range(n)])


# ── Görsel dönüşümleri ───────────────────────────────────────────────────
def pdf_gorsellere_cevir(data: bytes, dpi: int = 150) -> list[tuple[str, bytes]]:
    doc = fitz.open(stream=data, filetype="pdf")
    oran = dpi / 72
    mat = fitz.Matrix(oran, oran)
    sonuc = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat)
        sonuc.append((f"sayfa_{i+1}.png", pix.tobytes("png")))
    doc.close()
    return sonuc


def gorselleri_pdfe_cevir(dosyalar: list[bytes]) -> bytes:
    if not dosyalar:
        raise PdfAraciHatasi("En az bir görsel gerekli.")
    out = fitz.open()
    for data in dosyalar:
        try:
            img_doc = fitz.open(stream=data, filetype=None)
            pdf_bytes = img_doc.convert_to_pdf()
            img_doc.close()
        except Exception as e:
            raise PdfAraciHatasi(f"Görsel okunamadı (bozuk/desteklenmeyen format): {e}")
        img_pdf = fitz.open("pdf", pdf_bytes)
        out.insert_pdf(img_pdf)
        img_pdf.close()
    b = out.tobytes()
    out.close()
    return b


def pdf_metne_cevir(data: bytes) -> str:
    doc = fitz.open(stream=data, filetype="pdf")
    parcalar = []
    for i, page in enumerate(doc):
        parcalar.append(f"\n\n--- Sayfa {i+1} ---\n\n{page.get_text()}")
    doc.close()
    return "".join(parcalar).strip()


# ── Office <-> PDF (LibreOffice headless) ───────────────────────────────
def _soffice_donustur(data: bytes, kaynak_ad: str, hedef_uzanti: str) -> bytes:
    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        girdi = tmp / kaynak_ad
        girdi.write_bytes(data)
        profil = tmp / "lo_profile"
        # Her çağrı kendi UserInstallation profiliyle çalışır — soffice,
        # aynı profille eşzamanlı iki örnek başlatılırsa kilitlenip
        # "başka bir kopya çalışıyor" hatası veriyor (bilinen sorun,
        # sunucu tarafı toplu/eşzamanlı kullanımda gerçek bir risk).
        komut = [
            "soffice", "--headless", "--norestore", "--invisible", "--nologo",
            f"-env:UserInstallation=file://{profil.as_posix()}",
            "--convert-to", hedef_uzanti,
            "--outdir", str(tmp),
            str(girdi),
        ]
        try:
            r = subprocess.run(komut, capture_output=True, timeout=180)
        except FileNotFoundError:
            raise PdfAraciHatasi(
                "LibreOffice (soffice) sunucuda bulunamadı — Office<->PDF "
                "dönüşümü için core image'ının LibreOffice içerecek şekilde "
                "yeniden build edilmesi gerekiyor (docker compose up -d --build)."
            )
        except subprocess.TimeoutExpired:
            raise PdfAraciHatasi("Dönüştürme zaman aşımına uğradı (180sn) — dosya çok büyük ya da soffice takıldı.")

        cikti = tmp / f"{girdi.stem}.{hedef_uzanti}"
        if not cikti.exists():
            hata = (r.stderr or b"").decode("utf-8", errors="replace").strip()[:500]
            raise PdfAraciHatasi(f"Dönüştürme başarısız oldu.{(' Detay: ' + hata) if hata else ''}")
        return cikti.read_bytes()


def office_to_pdf(data: bytes, orijinal_ad: str) -> bytes:
    uzanti = Path(orijinal_ad or "belge").suffix.lower()
    if uzanti not in OFFICE_TO_PDF_UZANTILARI:
        raise PdfAraciHatasi(f"Desteklenmeyen kaynak format: '{uzanti or '(uzantısız)'}'")
    guvenli_ad = "girdi" + uzanti
    return _soffice_donustur(data, guvenli_ad, "pdf")


def pdf_to_office(data: bytes, hedef_format: str) -> bytes:
    """PDF -> Office. LibreOffice KULLANILMIYOR — LibreOffice bir PDF'i
    içeri aktarırken onu Draw belgesi olarak açıyor, bu yüzden
    `--convert-to docx/xlsx/pptx` her zaman "no export filter" hatasıyla
    başarısız oluyor (gerçek build'de doğrulandı, bilinen bir LibreOffice
    kısıtı). Bunun yerine format başına gerçekten çalışan, saf Python
    kütüphaneler kullanılıyor — bkz. _pdf_to_docx/_pdf_to_xlsx/_pdf_to_pptx."""
    hedef_format = (hedef_format or "").lower().lstrip(".")
    if hedef_format not in PDF_TO_OFFICE_HEDEFLERI:
        raise PdfAraciHatasi(f"Desteklenmeyen hedef format: '{hedef_format}'")
    _pdf_dogrula(data)
    if hedef_format == "docx":
        return _pdf_to_docx(data)
    if hedef_format == "xlsx":
        return _pdf_to_xlsx(data)
    if hedef_format == "pptx":
        return _pdf_to_pptx(data)
    raise PdfAraciHatasi(f"Desteklenmeyen hedef format: '{hedef_format}'")


_PDF_TO_DOCX_ZAMAN_ASIMI_SN = 90


def _pdf_to_docx(data: bytes) -> bytes:
    """pdf2docx (PyMuPDF tabanlı, düzen farkındalıklı) — LibreOffice'in
    aksine gerçekten metin/tablo/görsel içeren düzenlenebilir bir .docx
    üretir. Yaklaşık bir dönüşümdür, karmaşık düzenlerde biçim tam
    korunmayabilir (README/HELP'te belirtildi).

    Kök nedeni bulunan bir performans sorununa karşı iki katmanlı önlem:
    1. `parse_stream_table=False` — pdf2docx varsayılan olarak kenarlıksız
       ("stream") tabloları salt metin hizalamasına bakarak algılamaya
       çalışır; numaralı madde listesi + iki sütunlu düzene sahip gerçek
       bir belgede (SICK lisans metni) bu algılama SÜRESİZ takılı kaldığı
       doğrulandı (aynı belge bu bayrak kapalıyken ~1 saniyede dönüşüyor).
       Bedeli: kenarlıksız gerçek tablolar artık Word tablosu olarak değil
       düz paragraf olarak gelir — ama zaten bu tür belgelerde "tablo"
       algılanan şey çoğunlukla yanlış pozitiftir (numaralı liste vb.).
    2. Zaman aşımı: yukarıdaki düzeltmeye rağmen başka bir belge türü
       benzer şekilde takılırsa kullanıcı süresiz beklemek yerine belirli
       bir süre sonra net bir hata görür (arka plandaki iş parçacığı
       pdf2docx'in kendi sınırlaması nedeniyle iptal edilemiyor, ama en
       azından HTTP isteği süresiz asılı kalmıyor)."""
    from pdf2docx import Converter

    def _donustur(girdi_yolu: str, cikti_yolu: str) -> None:
        cv = Converter(girdi_yolu)
        try:
            cv.convert(cikti_yolu, parse_stream_table=False)
        finally:
            cv.close()

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        girdi = tmp / "girdi.pdf"
        girdi.write_bytes(data)
        cikti = tmp / "cikti.docx"
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as havuz:
            gelecek = havuz.submit(_donustur, str(girdi), str(cikti))
            try:
                gelecek.result(timeout=_PDF_TO_DOCX_ZAMAN_ASIMI_SN)
            except concurrent.futures.TimeoutError:
                raise PdfAraciHatasi(
                    f"PDF → Word dönüşümü {_PDF_TO_DOCX_ZAMAN_ASIMI_SN} saniyede tamamlanamadı "
                    "(karmaşık sayfa içeriği pdf2docx'i takılmaya zorluyor olabilir)."
                )
            except Exception as e:
                raise PdfAraciHatasi(f"PDF → Word dönüşümü başarısız oldu: {e}")
        if not cikti.exists():
            raise PdfAraciHatasi("PDF → Word dönüşümü başarısız oldu.")
        return cikti.read_bytes()


def _pdf_to_xlsx(data: bytes) -> bytes:
    """Sayfalardaki tabloları (fitz'in kendi tablo algılayıcısı ile)
    çıkarıp her birini ayrı bir sayfaya yazar. Hiç tablo bulunamazsa
    (çoğu PDF'te normal), düz metni tek sütunda bir "Metin" sayfasına
    döker — hiçbir zaman boş bir dosya döndürmez."""
    from openpyxl import Workbook

    doc = fitz.open(stream=data, filetype="pdf")
    wb = Workbook()
    wb.remove(wb.active)
    tablo_sayaci = 0

    for pno, page in enumerate(doc):
        try:
            bulunanlar = page.find_tables()
        except Exception:
            bulunanlar = None
        if not bulunanlar or not bulunanlar.tables:
            continue
        for ti, tablo in enumerate(bulunanlar.tables, start=1):
            tablo_sayaci += 1
            ws = wb.create_sheet(title=f"S{pno+1}_T{ti}"[:31])
            for satir in tablo.extract():
                ws.append(["" if h is None else h for h in satir])
    doc.close()

    if tablo_sayaci == 0:
        ws = wb.create_sheet(title="Metin")
        for satir in pdf_metne_cevir(data).splitlines():
            ws.append([satir])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _pdf_to_pptx(data: bytes) -> bytes:
    """Her PDF sayfasını, aynı en-boy oranını koruyan bir slayta tam
    kaplayan görsel olarak ekler. Metin DÜZENLENEBİLİR DEĞİLDİR — PDF
    sayfalarını sunum formatında yeniden kullanmak/paylaşmak için bir
    yaklaşım (gerçek bir "PDF sayfası -> düzenlenebilir slayt" dönüşümü
    hiçbir açık kaynak araçla güvenilir şekilde yapılamıyor)."""
    from pptx import Presentation
    from pptx.util import Emu

    NOKTA_TO_EMU = 12700  # 1 point = 12700 EMU (1 inch = 72pt = 914400 EMU)

    doc = fitz.open(stream=data, filetype="pdf")
    if len(doc) == 0:
        doc.close()
        raise PdfAraciHatasi("PDF'te hiç sayfa yok.")

    ilk = doc[0].rect
    prs = Presentation()
    prs.slide_width = Emu(int(ilk.width * NOKTA_TO_EMU))
    prs.slide_height = Emu(int(ilk.height * NOKTA_TO_EMU))
    bos_duzen = prs.slide_layouts[6]  # "Blank"

    gorseller = pdf_gorsellere_cevir(data, dpi=150)
    for i, (_, png) in enumerate(gorseller):
        page_rect = doc[i].rect
        slide = prs.slides.add_slide(bos_duzen)
        slide.shapes.add_picture(
            io.BytesIO(png), Emu(0), Emu(0),
            width=Emu(int(page_rect.width * NOKTA_TO_EMU)),
            height=Emu(int(page_rect.height * NOKTA_TO_EMU)),
        )
    doc.close()

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


# ── Toplu vurgulama ───────────────────────────────────────────────────────
def sayfalarda_ara_ve_vurgula(
    data: bytes, sayfalar: list[int], metin: str, renk: str = "#ffff00"
) -> tuple[bytes, int, int]:
    """Verilen sayfa listesinde `metin`i (PyMuPDF'in kendi arama
    algoritması ile, kelime sınırı gözetmeden alt-dize eşleşmesi) arar,
    HER eşleşmeyi tek tek değil, sayfa başına TEK bir highlight
    annotation'ında (birden çok quad) vurgular — "3-7. sayfaları vurgula"
    gibi tek seferlik toplu işlemler için (manuel sürükle-seç ile tek tek
    vurgulamanın yerine geçmiyor, onu tamamlıyor). Metin bulunamayan
    sayfalar sessizce atlanır. (eslesme_sayisi, sayfa_sayisi) döner."""
    if not metin.strip():
        raise PdfAraciHatasi("Aranacak bir metin girin.")
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        toplam_eslesme = 0
        eslesen_sayfa_sayisi = 0
        for sayfa_no in sayfalar:
            if sayfa_no < 0 or sayfa_no >= len(doc):
                continue
            page = doc[sayfa_no]
            quads = page.search_for(metin, quads=True)
            if not quads:
                continue
            annot = page.add_highlight_annot(quads)
            annot.set_colors(stroke=_hex_to_rgb(renk))
            annot.update()
            toplam_eslesme += len(quads)
            eslesen_sayfa_sayisi += 1
        if toplam_eslesme == 0:
            raise PdfAraciHatasi(f"\"{metin}\" belirtilen sayfalarda bulunamadı.")
        b = doc.tobytes()
    finally:
        doc.close()
    return b, toplam_eslesme, eslesen_sayfa_sayisi


# ── Damga / metin / görsel / vurgu / not ekleme ──────────────────────────
def katman_ekle(data: bytes, katmanlar: list[dict]) -> bytes:
    """katmanlar, "tur" alanına göre değişen şekilli sözlükler:
    - {"tur":"metin","sayfa":0,"x":..,"y":..,"metin":..,"boyut":14,
       "renk":"#000000","kalin":False}
    - {"tur":"gorsel","sayfa":0,"x":..,"y":..,"veri_b64":..,
       "genislik":..,"yukseklik":..}
    - {"tur":"vurgu","sayfa":0,"bboxes":[[x0,y0,x1,y1],...],"renk":"#ffff00"}
      (tekil "bbox" da kabul edilir) — gerçek bir PDF Highlight
      annotation'ı (metin katmanının altına değil, PDF'in kendi vurgu
      mekanizmasıyla eklenir — metni SİLMEZ/değiştirmez). Birden fazla
      bbox verilirse TEK bir annotation'da birden çok quad olarak eklenir
      (sürükle-seç ile birden fazla kelime seçildiğinde kullanılır).
    - {"tur":"not","sayfa":0,"x":..,"y":..,"metin":..,"baslik":..} —
      gerçek bir PDF sticky-note (Text) annotation'ı; PDF görüntüleyicide
      küçük bir ikon olarak durur, tıklanınca metni açılır."""
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        for k in katmanlar:
            sayfa_no = int(k.get("sayfa", 0))
            if sayfa_no < 0 or sayfa_no >= len(doc):
                continue
            page = doc[sayfa_no]
            tur = k.get("tur")
            if tur == "metin":
                x, y = float(k.get("x", 0)), float(k.get("y", 0))
                renk = _hex_to_rgb(k.get("renk", "#000000"))
                page.insert_text(
                    (x, y), str(k.get("metin", "")),
                    fontsize=float(k.get("boyut", 14)),
                    color=renk,
                    **_metin_font_kwargs(bool(k.get("kalin"))),
                )
            elif tur == "gorsel":
                x, y = float(k.get("x", 0)), float(k.get("y", 0))
                img_bytes = base64.b64decode(k["veri_b64"])
                genislik = float(k.get("genislik", 120))
                yukseklik = float(k.get("yukseklik", 120))
                rect = fitz.Rect(x, y, x + genislik, y + yukseklik)
                try:
                    page.insert_image(rect, stream=img_bytes)
                except Exception as e:
                    # PyMuPDF, PNG/JPEG dışındaki formatlarda (ör. SVG,
                    # HEIC) "unknown image file format" ile çöküyor —
                    # gerçek kullanımda bulundu, yakalanmadan 500'e
                    # düşüyordu. Burada net bir hataya çeviriyoruz.
                    raise PdfAraciHatasi(
                        f"Görsel eklenemedi — desteklenmeyen dosya formatı olabilir "
                        f"(PNG veya JPEG kullanın). Detay: {e}"
                    )
            elif tur == "vurgu":
                # "bboxes" (birden fazla kelime, sürükle-seç ile) veya
                # geriye dönük uyum için tekil "bbox" — hepsi TEK bir
                # highlight annotation'ında birden çok quad olarak
                # eklenir (gerçek PDF görüntüleyicide tek bir vurgu gibi
                # davranır, ayrı ayrı değil).
                bboxlar = k.get("bboxes") or [k["bbox"]]
                rectler = [fitz.Rect(*bb) for bb in bboxlar]
                annot = page.add_highlight_annot(rectler)
                annot.set_colors(stroke=_hex_to_rgb(k.get("renk", "#ffff00")))
                annot.update()
            elif tur == "not":
                x, y = float(k.get("x", 0)), float(k.get("y", 0))
                annot = page.add_text_annot((x, y), str(k.get("metin", "")))
                annot.set_colors(stroke=(0.86, 0.15, 0.15), fill=(0.86, 0.15, 0.15))
                if k.get("baslik"):
                    annot.set_info(title=str(k["baslik"]))
                # PyMuPDF'in kendi büyük/çirkin "sticky note" ikonunu
                # rasterde (küçük-resim önizlemesinde) gizliyoruz — arayüz
                # üzerine kendi küçük Excel-tarzı ikonunu (.pdf-not-ikon)
                # çiziyor. Annotation Hidden bayrağı sadece render'ı
                # etkiler; notlari_listele() annots() ile hâlâ bulur.
                annot.set_flags(annot.flags | fitz.PDF_ANNOT_IS_HIDDEN)
                annot.update()
        b = doc.tobytes()
    finally:
        doc.close()
    return b


def notlari_listele(data: bytes, sayfa_no: int) -> list[dict]:
    """O sayfadaki Text (sticky-note) annotation'larını listeler — arayüz
    bunları düz PNG önizlemenin ÜZERİNE ayrı, gezinilebilir/tıklanabilir
    küçük ikonlar olarak yerleştirmek için kullanır (Excel'deki hücre
    yorumu ikonuna benzer bir deneyim istendi: küçük ikon + üzerine
    gelince notu gösteren bir kutu)."""
    doc = fitz.open(stream=data, filetype="pdf")
    if sayfa_no < 0 or sayfa_no >= len(doc):
        doc.close()
        return []
    sonuc = []
    for annot in doc[sayfa_no].annots() or []:
        if annot.type[1] != "Text":
            continue
        sonuc.append({
            "x": round(annot.rect.x0, 2),
            "y": round(annot.rect.y0, 2),
            "metin": annot.info.get("content", ""),
        })
    doc.close()
    return sonuc


def vurgulari_listele(data: bytes, sayfa_no: int) -> list[dict]:
    """O sayfadaki Highlight annotation'larını (xref + kapsadıkları alan)
    listeler — arayüz her vurgunun üzerine küçük bir "kaldır" işareti
    yerleştirmek için kullanır ("toplu vurgulama yapılabiliyor ama vurgu
    iptal edilemiyor, ancak geri al ile yapabiliyorum" geri bildirimi
    üzerine — artık TEK bir vurguyu, o ana kadarki diğer tüm
    değişiklikleri geri almadan kaldırmak mümkün)."""
    doc = fitz.open(stream=data, filetype="pdf")
    if sayfa_no < 0 or sayfa_no >= len(doc):
        doc.close()
        return []
    sonuc = []
    for annot in doc[sayfa_no].annots() or []:
        if annot.type[1] != "Highlight":
            continue
        r = annot.rect
        sonuc.append({
            "xref": annot.xref,
            "bbox": [round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)],
        })
    doc.close()
    return sonuc


def vurgu_sil(data: bytes, sayfa_no: int, xref: int) -> bytes:
    """Belirli bir Highlight annotation'ını (xref ile) kaldırır — sayfadaki
    diğer değişiklikleri etkilemez."""
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        if sayfa_no < 0 or sayfa_no >= len(doc):
            raise PdfAraciHatasi("Geçersiz sayfa.")
        page = doc[sayfa_no]
        hedef = None
        for annot in page.annots() or []:
            if annot.xref == xref:
                hedef = annot
                break
        if hedef is None:
            raise PdfAraciHatasi("Vurgu bulunamadı (zaten kaldırılmış olabilir).")
        page.delete_annot(hedef)
        b = doc.tobytes()
    finally:
        doc.close()
    return b


# ── Form (AcroForm) ──────────────────────────────────────────────────────
def form_alanlari(data: bytes) -> list[dict]:
    reader = PdfReader(io.BytesIO(data))
    alanlar = reader.get_fields() or {}
    sonuc = []
    for ad, alan in alanlar.items():
        sonuc.append({
            "ad": ad,
            "tur": str(alan.get("/FT", "")).lstrip("/"),
            "deger": str(alan.get("/V", "") or ""),
        })
    return sonuc


def form_doldur(data: bytes, degerler: dict) -> bytes:
    reader = PdfReader(io.BytesIO(data))
    writer = PdfWriter()
    writer.append(reader)
    for page in writer.pages:
        try:
            writer.update_page_form_field_values(page, degerler)
        except Exception:
            continue
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


# ── Metin paragraflarını çıkarma / düzenleme ─────────────────────────────
# PARAGRAF granülaritesinde çalışıyoruz. Denenen sıra (hepsi gerçek
# kullanımda test edildi):
#   1. SATIR (fitz "line") — sarılmış çok satırlı bir paragrafta kullanıcı
#      sadece ilk görsel satırı değiştirebiliyordu, geri kalanı olduğu gibi
#      kalıp anlamsız bir kalıntı bırakıyordu.
#   2. Ham fitz BLOĞU — bu sefer TERSİ sorun: yoğun/dar aralıklı numaralı
#      liste içeren belgelerde (ör. hukuki sözleşmeler) fitz, bir bölüm
#      başlığıyla altındaki 2 AYRI maddeyi TEK blokta birleştiriyordu.
#   3. (BURADAKİ) Kendi iki aşamalı mantığımız:
#      a) SATIR BİRLEŞTİRME — asılı girintili numaralı listelerde ("1.",
#         "2." gibi madde numarası ile metni AYNI satırda ama farklı X'te,
#         fitz'in AYRI "line" nesneleri olarak verdiği gerçek bir belgede
#         bulundu) aynı Y aralığındaki fitz satırları TEK görsel satıra
#         birleştirilir.
#      b) PARAGRAF SINIRLAMA — birleştirilmiş satırlar arasında stil
#         (boyut/kalınlık) değişimi, belirgin SOLA KAYMA (asılı girintili
#         yeni bir madde numarasının başlangıcı) ya da anormal büyük dikey
#         boşluk görüldüğünde yeni paragraf başlar.
def _fitz_satirlarini_gorsel_satira_birlestir(lines: list[dict]) -> list[dict]:
    satirlar: list[dict] = []
    for line in lines:
        spans = line.get("spans", [])
        if not spans or not "".join(s.get("text", "") for s in spans).strip():
            continue
        x0, y0, x1, y1 = line["bbox"]
        if satirlar and abs(satirlar[-1]["y0"] - y0) < 2:
            onceki = satirlar[-1]
            # Aradaki boşluk sahte bir span'la ekleniyor — asılı girintili
            # madde numarası ("1.") ile metni ("Es gelten...") birleşince
            # "1.Es gelten" gibi bitişik çıkmasın diye.
            onceki["spans"] = onceki["spans"] + [{"text": " "}] + spans
            onceki["x1"] = max(onceki["x1"], x1)
            onceki["y1"] = max(onceki["y1"], y1)
        else:
            satirlar.append({"spans": list(spans), "x0": x0, "y0": y0, "x1": x1, "y1": y1})
    return satirlar


def _paragraflara_ayir(lines: list[dict]) -> list[list[dict]]:
    satirlar = _fitz_satirlarini_gorsel_satira_birlestir(lines)
    gruplar: list[list[dict]] = []
    onceki = None  # {"y1", "x0", "boyut", "kalin"}
    for satir in satirlar:
        spans = satir["spans"]
        boyut = spans[0].get("size", 11)
        kalin = bool(spans[0].get("flags", 0) & 16)
        if onceki is None:
            yeni_paragraf = True
        else:
            dikey_bosluk = satir["y0"] - onceki["y1"]
            stil_degisti = abs(boyut - onceki["boyut"]) > 0.5 or kalin != onceki["kalin"]
            sola_kayma = (onceki["x0"] - satir["x0"]) > 5
            buyuk_bosluk = dikey_bosluk > boyut * 0.65
            yeni_paragraf = stil_degisti or sola_kayma or buyuk_bosluk
        if yeni_paragraf:
            gruplar.append([])
        gruplar[-1].append(satir)
        onceki = {"y1": satir["y1"], "x0": satir["x0"], "boyut": boyut, "kalin": kalin}
    return gruplar


def kelimeleri_cikar(data: bytes, sayfa_no: int) -> list[dict]:
    """Vurgulama modunda tüm paragrafı değil TEK BİR KELİMEYİ işaretlemek
    isteyen kullanıcılar için (gerçek kullanımda istendi: "vurgula satırın
    tamamına uygulanıyor, kelime olarak ayıramıyorum").

    ÖNEMLİ: fitz'in hazır `get_text('words')` çıkarımı KULLANILMIYOR — o,
    kelime sınırlarını (boşluk karakterine değil) karakterler arası
    GEOMETRİK boşluğa bakarak belirliyor. Gerçek kullanımda (SICK
    belgesi, iki yana yaslanmış/justified metin) bu yüzden "Bedingungen"
    gibi bir kelime, yaslama için karakterler arası açıklık normalden
    biraz fazla olduğunda "Bed" + "ingungen" gibi İKİ ayrı kelimeye
    bölünüyordu — kullanıcı fare imleciyle doğru kelimeyi seçemiyordu
    ("mouse cursor doğru satırı seçemiyor" geri bildirimi). Bunun yerine
    karakterleri kendimiz GERÇEK boşluk (Unicode whitespace) karakterine
    göre kelimelere ayırıyoruz (`get_text('rawdict')` ile karakter
    bazlı) — PDF içerik akışında gerçek bir boşluk karakteri yoksa asla
    bölünmez, aradaki piksel mesafesi ne olursa olsun."""
    doc = fitz.open(stream=data, filetype="pdf")
    if sayfa_no < 0 or sayfa_no >= len(doc):
        doc.close()
        return []
    ham = doc[sayfa_no].get_text("rawdict")
    doc.close()

    sonuc = []
    i = 0
    for block in ham.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                mevcut_metin = ""
                mevcut_kutu = None
                for ch in span.get("chars", []):
                    c = ch.get("c", "")
                    if not c or c.isspace():
                        if mevcut_metin:
                            sonuc.append({
                                "id": f"p{sayfa_no}_w{i}", "sayfa": sayfa_no,
                                "bbox": [round(v, 2) for v in mevcut_kutu], "metin": mevcut_metin,
                            })
                            i += 1
                            mevcut_metin, mevcut_kutu = "", None
                        continue
                    x0, y0, x1, y1 = ch["bbox"]
                    if mevcut_kutu is None:
                        mevcut_kutu = [x0, y0, x1, y1]
                    else:
                        mevcut_kutu = [min(mevcut_kutu[0], x0), min(mevcut_kutu[1], y0),
                                        max(mevcut_kutu[2], x1), max(mevcut_kutu[3], y1)]
                    mevcut_metin += c
                if mevcut_metin:
                    sonuc.append({
                        "id": f"p{sayfa_no}_w{i}", "sayfa": sayfa_no,
                        "bbox": [round(v, 2) for v in mevcut_kutu], "metin": mevcut_metin,
                    })
                    i += 1
    return sonuc


def metin_satirlarini_cikar(data: bytes, sayfa_no: int | None = None) -> list[dict]:
    doc = fitz.open(stream=data, filetype="pdf")
    sayfalar = range(len(doc)) if sayfa_no is None else [sayfa_no]
    sonuc = []
    for pno in sayfalar:
        if pno < 0 or pno >= len(doc):
            continue
        page = doc[pno]
        d = page.get_text("dict")
        for bi, block in enumerate(d.get("blocks", [])):
            if block.get("type") != 0:
                continue
            for gi, paragraf_satirlari in enumerate(_paragraflara_ayir(block.get("lines", []))):
                satir_metinleri = []
                ilk_span = None
                x0 = y0 = float("inf")
                x1 = y1 = float("-inf")
                for satir in paragraf_satirlari:
                    satir_metni = "".join(s.get("text", "") for s in satir["spans"]).strip()
                    if not satir_metni:
                        continue
                    satir_metinleri.append(satir_metni)
                    if ilk_span is None:
                        ilk_span = satir["spans"][0]
                    x0, y0 = min(x0, satir["x0"]), min(y0, satir["y0"])
                    x1, y1 = max(x1, satir["x1"]), max(y1, satir["y1"])
                if not satir_metinleri or ilk_span is None:
                    continue
                renk_int = ilk_span.get("color", 0)
                sonuc.append({
                    "id": f"p{pno}_b{bi}_g{gi}",
                    "sayfa": pno,
                    "bbox": [round(v, 2) for v in (x0, y0, x1, y1)],
                    "metin": " ".join(satir_metinleri),
                    "satir_sayisi": len(satir_metinleri),
                    "boyut": round(ilk_span.get("size", 11), 1),
                    "renk": "#%06x" % (renk_int & 0xFFFFFF),
                    "kalin": bool(ilk_span.get("flags", 0) & 16),
                })
    doc.close()
    return sonuc


def _kutuya_sigdirarak_yaz(page, ilk_rect: "fitz.Rect", metin: str, fontsize: float, color, font_kwargs: dict) -> None:
    """insert_textbox metin sığmadığında HİÇBİR ŞEY çizmiyor (bkz.
    metin_duzenlemelerini_uygula docstring'i) — bu yüzden önce kutuyu
    sayfa altına kadar büyüterek, sonra fontu küçülterek sığdırmayı
    dener; hiçbiri işe yaramazsa son bir ZORUNLU deneme yapar (taşsa
    bile bir şey yazılsın diye — asla tamamen sessiz kalmaz)."""
    rect = fitz.Rect(ilk_rect)
    boyut = fontsize
    sayfa_alt = page.rect.height - 8
    for _ in range(10):
        if page.insert_textbox(rect, metin, fontsize=boyut, color=color, align=0, **font_kwargs) >= 0:
            return
        if rect.y1 < sayfa_alt - 1:
            rect = fitz.Rect(rect.x0, rect.y0, rect.x1, min(rect.y1 + boyut * 3, sayfa_alt))
        else:
            boyut = max(4.0, boyut * 0.85)
    page.insert_textbox(rect, metin, fontsize=boyut, color=color, align=0, **font_kwargs)


def metin_duzenlemelerini_uygula(data: bytes, duzenlemeler: list[dict]) -> bytes:
    """duzenlemeler: [{"sayfa":0,"bbox":[x0,y0,x1,y1],"metin":..,"boyut":..,
    "renk":"#rrggbb","kalin":bool}] — "bbox" bir paragrafın (blok) TÜM
    satırlarını kapsayan birleşik dikdörtgendir.

    Kısıtlar (bilinçli v0.1 kararları, README/HELP'te belirtiliyor):
    - PDF içine gömülü orijinal font korunamaz — redaction (eski metni
      beyazla kapatma) + en yakın temel fontla (Helvetica/Helvetica-Bold)
      yeniden yazma yöntemi kullanılıyor. Zemin beyaz değilse düzenlenen
      bölge beyazlanır.
    - Yeni metin `insert_textbox` ile ORİJİNAL paragrafın kapladığı
      dikdörtgene otomatik satır kaydırmalı olarak yazılır. `insert_textbox`
      metin sığmadığında HİÇBİR ŞEY ÇİZMEZ (hepsi ya da hiçbiri) — gerçek
      kullanımda bulundu: kısa bir alana çok daha uzun bir metin yazılınca
      orijinal metin redaction ile silinip yenisi hiç görünmüyordu (sessiz
      veri kaybı). Bunu önlemek için `_kutuya_sigdirarak_yaz` önce kutuyu
      sayfa sonuna kadar büyütmeyi, sonra fontu küçültmeyi dener; en son
      çare olarak (aşırı uzun metinlerde) taşsa bile MUTLAKA bir şey yazar
      — asla tamamen boş bırakmaz."""
    doc = fitz.open(stream=data, filetype="pdf")
    sayfa_gruplari: dict[int, list[dict]] = {}
    for d in duzenlemeler:
        sayfa_gruplari.setdefault(int(d["sayfa"]), []).append(d)

    for sayfa_no, degisiklikler in sayfa_gruplari.items():
        if sayfa_no < 0 or sayfa_no >= len(doc):
            continue
        page = doc[sayfa_no]
        for d in degisiklikler:
            rect = fitz.Rect(*d["bbox"])
            page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions()
        for d in degisiklikler:
            rect = fitz.Rect(*d["bbox"])
            renk = _hex_to_rgb(d.get("renk", "#000000"))
            _kutuya_sigdirarak_yaz(
                page, rect, str(d.get("metin", "")),
                fontsize=float(d.get("boyut", 11) or 11),
                color=renk,
                font_kwargs=_metin_font_kwargs(bool(d.get("kalin"))),
            )
    b = doc.tobytes()
    doc.close()
    return b


# web.py bu modüldeki fonksiyonlara bağımlı — import en sonda (circular import önlemi).
from .web import web_analyze, web_execute, web_rollback, router  # noqa: E402
