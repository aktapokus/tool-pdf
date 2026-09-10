"""
tools/pdf/web.py
PDF Aracı — router (AGENTS.md Madde 4.1: "istek+klasör" modeline uymayan,
dosya yükleme temelli işlemler) + standart web_analyze/execute/rollback
(AGENTS.md Madde 3: SADECE "AI ile Düzenle" sekmesi bunu kullanır).

Mekanik işlemler (birleştir/böl/döndür/dönüştür/damga/form) senkron ve
oturum tabanlıdır: POST /oturum/yukle bir oturum_id döner, sonraki her
işlem o oturumun GÜNCEL PDF'ini günceller ve sonucu doğrudan dosya olarak
yanıtlar — core'un plan/onay akışına ihtiyaç yok, hiçbiri LLM kullanmıyor.

AI ile Düzenle sekmesi ise aynı oturum_id'yi core'un standart
/api/analyze -> /api/execute akışına sokuyor (Görsel Sınıflandırıcı'daki
AYIRICI deseniyle birebir aynı yaklaşım): kullanıcının serbest metin
isteği + oturum_id tek bir "istek" string'inde birleştirilip gönderilir.
"""

from __future__ import annotations

import io
import json
import uuid
import zipfile

from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import Response

from . import (
    PdfAraciHatasi,
    oturum_yukle, oturum_oku, oturum_yaz, oturum_sifirla,
    oturum_geri_al, oturum_ileri_al, oturum_geri_alinabilir_mi, oturum_ileri_alinabilir_mi,
    sayfa_sayisi, kucuk_resim_uret, sayfa_olculeri,
    sayfalari_birlestir, sayfalari_uygula, pdf_bol, pdf_her_sayfayi_ayir,
    pdf_gorsellere_cevir, gorselleri_pdfe_cevir, pdf_metne_cevir,
    office_to_pdf, pdf_to_office,
    katman_ekle, form_alanlari, form_doldur, kelimeleri_cikar, notlari_listele,
    metin_satirlarini_cikar, metin_duzenlemelerini_uygula, sayfalarda_ara_ve_vurgula,
    vurgulari_listele, vurgu_sil,
)

router = APIRouter()

AYIRICI = "\n---AKTAPOKUS_PDF_OTURUM---\n"


# ── Yardımcılar ──────────────────────────────────────────────────────────
def _pdf_yaniti(data: bytes, dosya_adi: str = "sonuc.pdf") -> Response:
    return Response(
        content=data, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{dosya_adi}"'},
    )


def _zip_yaniti(dosyalar: list[tuple[str, bytes]], zip_adi: str = "sonuc.zip") -> Response:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for ad, b in dosyalar:
            z.writestr(ad, b)
    return Response(
        content=buf.getvalue(), media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_adi}"'},
    )


def _hata_yaniti(e: PdfAraciHatasi) -> Response:
    return Response(content=json.dumps({"hata": str(e)}), media_type="application/json", status_code=400)


def _oturum_pdf_veya_hata(oturum_id: str) -> bytes | Response:
    data = oturum_oku(oturum_id)
    if data is None:
        return Response(
            content=json.dumps({"hata": "Oturum bulunamadı ya da süresi doldu — PDF'i tekrar yükleyin."}),
            media_type="application/json", status_code=404,
        )
    return data


# ── Oturum ────────────────────────────────────────────────────────────────
@router.post("/oturum/yukle")
async def oturum_yukle_endpoint(file: UploadFile = File(...)):
    data = await file.read()
    try:
        oturum_id, n = oturum_yukle(data)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    return {"oturum_id": oturum_id, "sayfa_sayisi": n}


@router.get("/oturum/{oturum_id}/indir")
def oturum_indir(oturum_id: str):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    return _pdf_yaniti(sonuc, "duzenlenmis.pdf")


@router.post("/oturum/{oturum_id}/sifirla")
def oturum_sifirla_endpoint(oturum_id: str):
    data = oturum_sifirla(oturum_id)
    if data is None:
        return Response(content=json.dumps({"hata": "Oturum bulunamadı."}), media_type="application/json", status_code=404)
    return {"sayfa_sayisi": sayfa_sayisi(data)}


@router.get("/oturum/{oturum_id}/gecmis-durumu")
def gecmis_durumu(oturum_id: str):
    return {
        "geri_alinabilir": oturum_geri_alinabilir_mi(oturum_id),
        "ileri_alinabilir": oturum_ileri_alinabilir_mi(oturum_id),
    }


@router.post("/oturum/{oturum_id}/geri-al")
def geri_al_endpoint(oturum_id: str):
    data = oturum_geri_al(oturum_id)
    if data is None:
        return Response(content=json.dumps({"hata": "Geri alınacak bir değişiklik yok."}), media_type="application/json", status_code=404)
    return {
        "sayfa_sayisi": sayfa_sayisi(data),
        "geri_alinabilir": oturum_geri_alinabilir_mi(oturum_id),
        "ileri_alinabilir": oturum_ileri_alinabilir_mi(oturum_id),
    }


@router.post("/oturum/{oturum_id}/ileri-al")
def ileri_al_endpoint(oturum_id: str):
    data = oturum_ileri_al(oturum_id)
    if data is None:
        return Response(content=json.dumps({"hata": "İleri alınacak bir değişiklik yok."}), media_type="application/json", status_code=404)
    return {
        "sayfa_sayisi": sayfa_sayisi(data),
        "geri_alinabilir": oturum_geri_alinabilir_mi(oturum_id),
        "ileri_alinabilir": oturum_ileri_alinabilir_mi(oturum_id),
    }


# ── Sayfa önizleme / bilgi ───────────────────────────────────────────────
@router.get("/oturum/{oturum_id}/kucuk-resim/{sayfa_no}")
def kucuk_resim(oturum_id: str, sayfa_no: int, max_kenar: int = 220):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        png = kucuk_resim_uret(sonuc, sayfa_no, max_kenar=max(120, min(max_kenar, 2200)))
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    return Response(content=png, media_type="image/png")


@router.get("/oturum/{oturum_id}/sayfa-olcu/{sayfa_no}")
def sayfa_olcu_endpoint(oturum_id: str, sayfa_no: int):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        genislik, yukseklik = sayfa_olculeri(sonuc, sayfa_no)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    return {"genislik": genislik, "yukseklik": yukseklik}


# ── Sayfa işlemleri ──────────────────────────────────────────────────────
@router.post("/birlestir")
async def birlestir(files: list[UploadFile] = File(...)):
    dosyalar = [await f.read() for f in files]
    try:
        pdf = sayfalari_birlestir(dosyalar)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    return _pdf_yaniti(pdf, "birlesik.pdf")


@router.post("/oturum/{oturum_id}/sayfalar/uygula")
async def sayfalar_uygula_endpoint(oturum_id: str, plan: str = Form(...)):
    """plan: JSON string — [{"index":0,"dondur":90}, ...] (Form ile
    gönderiliyor, çünkü sayfa küçük resimleri sürükle-bırak arayüzünde
    üretiliyor ve dosya yeniden yüklenmiyor)."""
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        plan_liste = json.loads(plan)
        yeni_pdf = sayfalari_uygula(sonuc, plan_liste)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    except (json.JSONDecodeError, TypeError, KeyError):
        return _hata_yaniti(PdfAraciHatasi("Geçersiz sayfa planı."))
    oturum_yaz(oturum_id, yeni_pdf)
    return _pdf_yaniti(yeni_pdf, "duzenlenmis.pdf")


@router.post("/oturum/{oturum_id}/bol")
def bol(oturum_id: str, araliklar: str = Form(...)):
    """araliklar: JSON string — [[0,2],[3,5]] (0-tabanlı, dahil-dahil).
    "hepsi" gönderilirse her sayfa ayrı dosya olur."""
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        if araliklar.strip() == '"hepsi"':
            parcalar = pdf_her_sayfayi_ayir(sonuc)
        else:
            ham = json.loads(araliklar)
            parcalar = pdf_bol(sonuc, [tuple(a) for a in ham])
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    except (json.JSONDecodeError, TypeError, ValueError):
        return _hata_yaniti(PdfAraciHatasi("Geçersiz bölme aralığı."))
    return _zip_yaniti(parcalar, "bolunmus.zip")


# ── Görsel dönüşümleri ───────────────────────────────────────────────────
@router.get("/oturum/{oturum_id}/gorsellere-cevir")
def gorsellere_cevir(oturum_id: str, dpi: int = 150):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    gorseller = pdf_gorsellere_cevir(sonuc, dpi=max(72, min(dpi, 400)))
    return _zip_yaniti(gorseller, "sayfalar.zip")


@router.post("/gorsellerden-pdf")
async def gorsellerden_pdf(files: list[UploadFile] = File(...)):
    dosyalar = [await f.read() for f in files]
    try:
        pdf = gorselleri_pdfe_cevir(dosyalar)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    return _pdf_yaniti(pdf, "gorsellerden.pdf")


@router.get("/oturum/{oturum_id}/metne-cevir")
def metne_cevir(oturum_id: str):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    metin = pdf_metne_cevir(sonuc)
    return Response(
        content=metin.encode("utf-8"), media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="metin.txt"'},
    )


# ── Office <-> PDF ───────────────────────────────────────────────────────
@router.post("/office-to-pdf")
async def office_to_pdf_endpoint(file: UploadFile = File(...)):
    data = await file.read()
    try:
        pdf = office_to_pdf(data, file.filename or "belge")
        oturum_id, n = oturum_yukle(pdf)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    return {"oturum_id": oturum_id, "sayfa_sayisi": n}


@router.get("/oturum/{oturum_id}/pdf-to-office")
def pdf_to_office_endpoint(oturum_id: str, hedef: str = "docx"):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        cikti = pdf_to_office(sonuc, hedef)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    return Response(
        content=cikti, media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="donusturulen.{hedef}"'},
    )


# ── Damga / metin / görsel ekleme ────────────────────────────────────────
@router.post("/oturum/{oturum_id}/katman-ekle")
def katman_ekle_endpoint(oturum_id: str, katmanlar: str = Form(...)):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        katman_liste = json.loads(katmanlar)
        yeni_pdf = katman_ekle(sonuc, katman_liste)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    except (json.JSONDecodeError, TypeError, KeyError, ValueError):
        return _hata_yaniti(PdfAraciHatasi("Geçersiz katman verisi."))
    oturum_yaz(oturum_id, yeni_pdf)
    return _pdf_yaniti(yeni_pdf, "damgali.pdf")


@router.post("/oturum/{oturum_id}/toplu-vurgu")
def toplu_vurgu_endpoint(oturum_id: str, metin: str = Form(...), sayfalar: str = Form(...), renk: str = Form("#ffff00")):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        sayfa_liste = json.loads(sayfalar)
        yeni_pdf, eslesme, sayfa_sayisi_eslesen = sayfalarda_ara_ve_vurgula(sonuc, sayfa_liste, metin, renk)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    except (json.JSONDecodeError, TypeError, ValueError):
        return _hata_yaniti(PdfAraciHatasi("Geçersiz sayfa listesi."))
    oturum_yaz(oturum_id, yeni_pdf)
    return {"eslesme_sayisi": eslesme, "sayfa_sayisi": sayfa_sayisi_eslesen}


# ── Form ──────────────────────────────────────────────────────────────────
@router.get("/oturum/{oturum_id}/form-alanlari")
def form_alanlari_endpoint(oturum_id: str):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    return {"alanlar": form_alanlari(sonuc)}


@router.post("/oturum/{oturum_id}/form-doldur")
def form_doldur_endpoint(oturum_id: str, degerler: str = Form(...)):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        deger_sozluk = json.loads(degerler)
        yeni_pdf = form_doldur(sonuc, deger_sozluk)
    except (json.JSONDecodeError, TypeError):
        return _hata_yaniti(PdfAraciHatasi("Geçersiz form verisi."))
    oturum_yaz(oturum_id, yeni_pdf)
    return _pdf_yaniti(yeni_pdf, "form_dolduruldu.pdf")


# ── Metin satırları (manuel düzenleme) ───────────────────────────────────
@router.get("/oturum/{oturum_id}/metin-satirlari")
def metin_satirlari_endpoint(oturum_id: str, sayfa: int | None = None):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    return {"satirlar": metin_satirlarini_cikar(sonuc, sayfa)}


@router.get("/oturum/{oturum_id}/kelimeler")
def kelimeler_endpoint(oturum_id: str, sayfa: int = 0):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    return {"satirlar": kelimeleri_cikar(sonuc, sayfa)}


@router.get("/oturum/{oturum_id}/notlar")
def notlar_endpoint(oturum_id: str, sayfa: int = 0):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    return {"notlar": notlari_listele(sonuc, sayfa)}


@router.get("/oturum/{oturum_id}/vurgular")
def vurgular_endpoint(oturum_id: str, sayfa: int = 0):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    return {"vurgular": vurgulari_listele(sonuc, sayfa)}


@router.post("/oturum/{oturum_id}/vurgu-sil")
def vurgu_sil_endpoint(oturum_id: str, sayfa: int = Form(...), xref: int = Form(...)):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        yeni_pdf = vurgu_sil(sonuc, sayfa, xref)
    except PdfAraciHatasi as e:
        return _hata_yaniti(e)
    oturum_yaz(oturum_id, yeni_pdf)
    return {"silindi": True}


@router.post("/oturum/{oturum_id}/metin-duzenle")
def metin_duzenle_endpoint(oturum_id: str, duzenlemeler: str = Form(...)):
    sonuc = _oturum_pdf_veya_hata(oturum_id)
    if isinstance(sonuc, Response):
        return sonuc
    try:
        duzen_liste = json.loads(duzenlemeler)
        yeni_pdf = metin_duzenlemelerini_uygula(sonuc, duzen_liste)
    except (json.JSONDecodeError, TypeError, KeyError, ValueError):
        return _hata_yaniti(PdfAraciHatasi("Geçersiz düzenleme verisi."))
    oturum_yaz(oturum_id, yeni_pdf)
    return _pdf_yaniti(yeni_pdf, "duzenlenmis.pdf")


# ── AI ile Düzenle — standart web_analyze/execute/rollback sözleşmesi ────
# (AGENTS.md Madde 3) — core'un paylaşılan LLM bağlantısını (llm_complete)
# burada, hiçbir yeni mekanizma icat etmeden kullanıyoruz.
_plan_store: dict[str, dict] = {}


def _json_ayikla(metin: str) -> str:
    metin = (metin or "").strip()
    if metin.startswith("```"):
        metin = metin.split("```")[1]
        if metin.startswith("json"):
            metin = metin[4:]
    return metin.strip()


def web_analyze(istek: str, klasor: str, llm_complete):
    ham = istek or ""
    if AYIRICI not in ham:
        return {"bos": True, "plan_id": None, "aciklama": "Önce bir PDF yükleyin.", "items": []}

    kullanici_istegi, oturum_id = ham.split(AYIRICI, 1)
    kullanici_istegi = kullanici_istegi.strip()
    oturum_id = oturum_id.strip()

    if not kullanici_istegi:
        return {"bos": True, "plan_id": None, "aciklama": "Neyi değiştirmek istediğinizi yazın (ör. \"başlıkları kırmızı yap\").", "items": []}

    data = oturum_oku(oturum_id)
    if data is None:
        return {"bos": True, "plan_id": None, "aciklama": "Oturum bulunamadı, PDF'i tekrar yükleyin.", "items": []}

    satirlar = metin_satirlarini_cikar(data)
    if not satirlar:
        return {"bos": True, "plan_id": None, "aciklama": "Bu PDF'te düzenlenebilir metin bulunamadı (taranmış görüntü olabilir).", "items": []}

    id_esleme = {s["id"]: s for s in satirlar}

    # Tüm belgenin satırlarını TEK bir promptta göndermek büyük PDF'lerde
    # sağlayıcının dakikalık/istek başı token limitini (TPM) aşıyor —
    # gerçek kullanımda doğrulandı (Groq: "Limit 8000, Requested 17287").
    # Bunun yerine satırlar, her biri güvenli bir token bütçesinde kalan
    # PARÇALARA bölünüp ayrı ayrı gönderiliyor, sonuçlar birleştiriliyor.
    # Kaba tahmin: ~4 karakter ≈ 1 token (kesin değil ama yeterince temkinli).
    PARCA_TOKEN_BUTCESI = 2500

    def _satir_metni(s):
        return f"{s['id']}: (sayfa {s['sayfa']+1}, boyut {s['boyut']}, {'kalın' if s['kalin'] else 'normal'}, renk {s['renk']}) {s['metin'][:120]}"

    parcalar = []
    mevcut_parca, mevcut_token = [], 0
    for s in satirlar:
        satir_metni = _satir_metni(s)
        tahmini_token = max(1, len(satir_metni) // 4)
        if mevcut_parca and mevcut_token + tahmini_token > PARCA_TOKEN_BUTCESI:
            parcalar.append(mevcut_parca)
            mevcut_parca, mevcut_token = [], 0
        mevcut_parca.append(satir_metni)
        mevcut_token += tahmini_token
    if mevcut_parca:
        parcalar.append(mevcut_parca)

    def _prompt_olustur(liste_metni):
        return f"""Aşağıda bir PDF belgesindeki metin satırları listelendi. Kullanıcının
isteğine göre HANGİ satırların stilini (renk/kalınlık/boyut) değiştirmen
ya da metnini güncellemen gerektiğine karar ver.

Kullanıcının isteği: {kullanici_istegi}

Satırlar (id: (sayfa, boyut, kalınlık, renk) metin):
{liste_metni}

SADECE şu JSON formatında cevap ver, başka hiçbir açıklama ekleme:
{{"degisiklikler": [{{"id": "p0_b1_l0", "renk": "#dc2626", "kalin": true, "boyut": null, "metin": null, "vurgula": false}}]}}

Kurallar:
- "id" alanına yukarıdaki listeden AYNEN kopyaladığın id'yi yaz.
- Sadece isteğe uyan satırları listeye ekle, gerisini ekleme.
- Değiştirmek istemediğin alanları null bırak (mevcut değer korunur).
- "renk" bir hex kod olsun (#rrggbb) — bu YAZI RENGİDİR, arka plan vurgusu değildir.
- Kullanıcı açıkça metni değiştirmeni istemediyse "metin" alanını null bırak.
- Kullanıcı bir satırı VURGULAMANI (fosforlu kalem gibi arka planı renklendirmeni, "işaretle", "vurgula", "highlight yap" gibi) istiyorsa "vurgula" alanını true yap — bu, metni SİLMEZ/DEĞİŞTİRMEZ, gerçek bir PDF vurgu/highlight işaretlemesidir. İstemiyorsa false bırak."""

    degisiklikler = []
    kesildi = False
    for parca in parcalar:
        try:
            ham_cevap = llm_complete(_prompt_olustur("\n".join(parca)), json_mode=True)
        except RuntimeError:
            # Sağlayıcı hata verdi (zaman aşımı / rate limit / vb.) — o ana
            # kadar toplanan sonuçları KAYBETMEDEN dur; kullanıcı en azından
            # işlenen parçaların değişikliklerini görüp onaylayabilsin,
            # geri kalanı için isteği tekrar dener.
            kesildi = True
            break
        try:
            ayrisik = json.loads(_json_ayikla(ham_cevap))
        except (json.JSONDecodeError, TypeError):
            continue  # bu parça geçersiz cevap verdi — diğer parçalarla devam
        if isinstance(ayrisik, dict):
            degisiklikler.extend(ayrisik.get("degisiklikler", []) or [])

    if not degisiklikler:
        if kesildi:
            return {"bos": True, "plan_id": None, "aciklama": "Sağlayıcıdan hata alındı (rate limit/zaman aşımı olabilir), lütfen kısa süre sonra tekrar deneyin.", "items": []}
        return {"bos": True, "plan_id": None, "aciklama": "İsteğinize uyan bir satır bulunamadı (ya da model geçerli bir cevap üretemedi).", "items": []}

    items = []
    for e in degisiklikler:
        sid = str(e.get("id", "")).strip()
        orijinal = id_esleme.get(sid)
        if not orijinal:
            continue
        yeni = dict(orijinal)
        if e.get("renk"):
            yeni["renk"] = str(e["renk"])
        if e.get("kalin") is not None:
            yeni["kalin"] = bool(e["kalin"])
        if e.get("boyut"):
            try:
                yeni["boyut"] = float(e["boyut"])
            except (TypeError, ValueError):
                pass
        if e.get("metin"):
            yeni["metin"] = str(e["metin"])
        yeni["vurgula"] = bool(e.get("vurgula"))

        degisen_ozellikler = []
        if yeni["renk"] != orijinal["renk"]:
            degisen_ozellikler.append(f"renk → {yeni['renk']}")
        if yeni["kalin"] != orijinal["kalin"]:
            degisen_ozellikler.append("kalın" if yeni["kalin"] else "normal kalınlık")
        if yeni["boyut"] != orijinal["boyut"]:
            degisen_ozellikler.append(f"boyut → {yeni['boyut']}")
        if yeni["metin"] != orijinal["metin"]:
            degisen_ozellikler.append("metin değişecek")
        # Stil/metin GERÇEKTEN değişmediyse (sadece "vurgula" istendiyse)
        # metin_duzenlemelerini_uygula'yı hiç çağırmıyoruz — o fonksiyon
        # paragrafı SİLİP yeniden çiziyor (orijinal font kaybolur), salt
        # vurgu isteği için bu gereksiz ve kayıplı olurdu.
        yeni["_stil_degisti"] = bool(degisen_ozellikler)
        if yeni["vurgula"]:
            degisen_ozellikler.append("vurgulanacak")

        items.append({
            "id": sid,
            "sayfa": orijinal["sayfa"] + 1,
            "onceki_metin": orijinal["metin"][:80],
            "reason": ", ".join(degisen_ozellikler) or "stil güncellenecek",
            "_yeni": yeni,
        })

    if not items:
        return {"bos": True, "plan_id": None, "aciklama": "İsteğinize uyan bir satır bulunamadı.", "items": []}

    plan_id = str(uuid.uuid4())
    _plan_store[plan_id] = {"oturum_id": oturum_id, "items": items}

    aciklama = f"{len(items)} satır için değişiklik önerildi."
    if kesildi:
        aciklama += " (Belge büyük olduğu için bir kısmı işlenemedi — sağlayıcı hata verdi, isteğinizi tekrarlayarak kalanını deneyebilirsiniz.)"

    return {
        "bos": False,
        "plan_id": plan_id,
        "aciklama": aciklama,
        "items": [{k: v for k, v in it.items() if k != "_yeni"} for it in items],
    }


def web_execute(plan_id: str, approved_ids: list[str] | None):
    plan = _plan_store.get(plan_id)
    if not plan:
        return {"uygulanan": 0, "hatalar": ["Plan bulunamadı, süresi dolmuş olabilir."]}

    onay = set(approved_ids) if approved_ids else {it["id"] for it in plan["items"]}
    duzenlemeler = []
    vurgu_katmanlari = []
    for it in plan["items"]:
        if it["id"] not in onay:
            continue
        y = it["_yeni"]
        if y.get("_stil_degisti"):
            duzenlemeler.append({
                "sayfa": y["sayfa"], "bbox": y["bbox"], "metin": y["metin"],
                "boyut": y["boyut"], "renk": y["renk"], "kalin": y["kalin"],
            })
        # LLM bu satırı vurgulamaya karar verdiyse — metin stilinden BAĞIMSIZ
        # olarak gerçek bir PDF highlight annotation'ı da ekleniyor ("#5:
        # AI ile Düzenle şu an sadece renk/kalınlık/boyut değiştirebiliyor"
        # geri bildirimi üzerine eklendi).
        if y.get("vurgula"):
            vurgu_katmanlari.append({"tur": "vurgu", "sayfa": y["sayfa"], "bbox": y["bbox"], "renk": "#ffff00"})

    data = oturum_oku(plan["oturum_id"])
    if data is None:
        return {"uygulanan": 0, "hatalar": ["Oturum bulunamadı."]}

    if duzenlemeler:
        yeni_pdf = metin_duzenlemelerini_uygula(data, duzenlemeler)
        oturum_yaz(plan["oturum_id"], yeni_pdf)
        data = yeni_pdf
    if vurgu_katmanlari:
        yeni_pdf = katman_ekle(data, vurgu_katmanlari)
        oturum_yaz(plan["oturum_id"], yeni_pdf)

    del _plan_store[plan_id]
    # Salt vurgu istekleri duzenlemeler'e girmiyor (bkz. yukarıdaki
    # _stil_degisti notu) — "uygulanan" sayısı yine de ikisini birden
    # yansıtmalı, aksi halde sadece vurgulama içeren bir plan onaylandığında
    # frontend "0 işlem" görüp sonuç önizlemesini/geçmişi güncellemezdi.
    return {"uygulanan": len(duzenlemeler) + len(vurgu_katmanlari), "hatalar": [], "session_id": plan["oturum_id"]}


def web_rollback(klasor: str, session_id: str):
    data = oturum_sifirla(session_id)
    if data is None:
        return {"basarili": False, "hatalar": ["Oturum bulunamadı."], "mesaj": "Oturum bulunamadı."}
    return {"basarili": True, "hatalar": [], "mesaj": "PDF, yüklendiği ilk hâline döndürüldü."}
