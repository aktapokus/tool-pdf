# PDF Aracı

Watermarksız PDF düzenleme ve dönüştürme aracı. `core.*` namespace, Faz 1.

## Ne yapar

1. **Sayfa işlemleri** — birleştirme, bölme, sayfa silme/döndürme/yeniden
   sıralama (sürükle-bırak).
2. **Format dönüşümü** — Word/Excel/PowerPoint → PDF ve PDF → Word/Excel/
   PowerPoint, PDF ↔ görsel (PNG), PDF → düz metin.
3. **Damga / içerik ekleme** — sayfa önizlemesine tıklayarak seçilen konuma
   metin veya görsel ekleme.
4. **Form doldurma** — PDF'teki AcroForm alanlarını okuma/doldurma.
5. **Metni düzenleme** — mevcut metin satırlarını (yerinde) değiştirme,
   hem manuel (satır listesi üzerinden) hem de **doğal dille**
   ("başlıkları kırmızı ve kalın yap" gibi bir talimatla, LLM'in hangi
   satırların değişeceğine karar verdiği plan/onay akışıyla).

Watermark **hiçbir çıktıya eklenmez** — bu, ayrı bir bayrak/ayar değil,
tasarımın kendisi.

## Neden LibreOffice — sadece Office → PDF yönünde

Office → PDF dönüşümü pip ile kurulabilen bir kütüphaneyle güvenilir
şekilde yapılamıyor — bu yüzden sistemde kurulu LibreOffice'in headless
modu (`soffice --convert-to pdf`) subprocess ile çağrılıyor.
`core/Dockerfile`'a `libreoffice-writer/calc/impress` eklendi (AGENTS.md
Madde 6 — additive, sadece bu tool'u etkiler; LibreOffice bulunamazsa ya
da dönüştürme başarısız olursa yalnızca ilgili istek 400 döner, core
çökmez). Bu değişiklik core repo'suna aittir; bu tool'u kuran kullanıcının
`docker compose up -d --build` çalıştırması (sadece `restart` yetmez)
gerekir — `setup.bat` bunu otomatik yapar.

**PDF → Office LibreOffice ile YAPILMIYOR.** Gerçek build'de doğrulandı:
LibreOffice bir PDF'i içeri aktarırken onu Draw belgesi olarak açıyor,
bu yüzden `--convert-to docx/xlsx/pptx` her zaman "no export filter"
hatasıyla başarısız oluyor (bilinen bir LibreOffice kısıtı, yapılandırma
hatası değil — bkz. `__init__.py: pdf_to_office` docstring'i). Bu yön
format başına gerçekten çalışan, saf Python kütüphaneleriyle yapılıyor:

- **docx** — `pdf2docx` (PyMuPDF tabanlı, düzen farkındalıklı gerçek metin
  çıkarımı).
- **xlsx** — fitz'in tablo algılayıcısı (`page.find_tables()`) ile
  bulunan tabloları sayfa sayfa yazar; hiç tablo yoksa düz metni tek
  sütunda döker.
- **pptx** — her sayfayı aynı en-boy oranını koruyan bir slayta TAM
  KAPLAYAN GÖRSEL olarak ekler (metin düzenlenebilir değildir — hiçbir
  açık kaynak araç PDF sayfasını güvenilir şekilde düzenlenebilir slayta
  çeviremiyor; bu, sayfaları sunum formatında yeniden kullanmak için
  pratik bir yaklaşım).

## Mimari

`web.py` iki farklı sözleşmeyi bir arada expose ediyor:

- **Kendi router'ı** (AGENTS.md Madde 4.1) — sayfa/dönüştür/damga/form
  gibi tüm mekanik işlemler, senkron, dosya yükleme/indirme temelli.
  Oturum tabanlı: `POST /oturum/yukle` bir `oturum_id` döner, sonraki her
  işlem o oturumun GÜNCEL PDF'ini günceller (ardışık düzenleme
  zincirlenebilsin diye) ve sonucu doğrudan dosya olarak yanıtlar.
- **Standart `web_analyze`/`web_execute`/`web_rollback`** (AGENTS.md
  Madde 3) — SADECE "AI ile Düzenle" sekmesi bunu kullanır, çünkü bu tek
  akış core'un paylaşılan LLM bağlantısına (`llm_complete`) ihtiyaç
  duyuyor. Görsel Sınıflandırıcı'daki AYIRICI deseniyle birebir aynı
  yaklaşımla, kullanıcının serbest metin isteği + `oturum_id` tek bir
  "istek" string'inde birleştirilip core'un `/api/analyze`'ine gönderilir.

Metin satırı çıkarma/düzenleme (hem manuel hem AI akışının ortak temeli)
PyMuPDF (`fitz`) ile **satır (line) granülaritesinde** çalışır — bir PDF
satırı genelde tek stil taşır, bu da tutarlı bir düzenleme birimi sağlar.
**Bilinçli kısıt:** orijinal gömülü font korunamaz; düzenlenen satır
redaction (beyazla kapatma) ile silinip en yakın temel fontla
(Helvetica/Helvetica-Bold) yeniden yazılır. Zemin beyaz değilse
düzenlenen bölge beyazlanır.

## Veri depolama

`data/oturumlar/` altında, her yüklenen PDF için `{id}.pdf` (güncel hâl)
ve `{id}_orijinal.pdf` (ilk yüklenen, değişmeyen kopya) tutulur. 24
saatten eski oturumlar her yeni yüklemede otomatik temizlenir. Rollback
(hem "AI ile Düzenle"nin "Geri Al" butonu hem de mekanik akıştaki
"Orijinale Dön" butonu) orijinal kopyaya döner — kalıcı bir dosya sistemi
işlemi değildir, sadece oturumun kendi çalışma kopyasını sıfırlar.

## Kurulum

`setup.bat`'ı çalıştırın — dosyaları `tools/pdf/`'e kopyalar ve core
container'ını **build ile** yeniden başlatır (LibreOffice indirileceği
için ilk kurulum birkaç dakika sürebilir, ~600 MB+ ek katman).

## Katkı

Ana core repo'sundaki MANIFESTO.md ve AGENTS.md'yi okuyun. PDF → Office
dönüşümü (xlsx/pptx) ve metin düzenleme fontu **yaklaşık** sonuç verir —
tam sadakat v0.1 kapsamı dışında, bilinçli bir karar.
