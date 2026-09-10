# PDF Aracı — Yardım

## Sekmeler

**Sayfalar** — Bir PDF yükleyin, sayfa kartlarını sürükleyip bırakarak
sırasını değiştirin, döndürme/silme ikonlarını kullanın, "Değişiklikleri
Uygula"ya basın. Aynı sekmede birden fazla PDF'i birleştirebilir veya
aktif PDF'i sayfa aralıklarına (`1-3,5,7-9` gibi) göre bölebilirsiniz.

**Dönüştür** — Word/Excel/PowerPoint dosyanızı PDF'e çevirin (sonuç
otomatik olarak aktif oturuma alınır, üzerinde diğer sekmelerle çalışmaya
devam edebilirsiniz). Aktif bir PDF varken onu Office formatına, görsele
(PNG, sayfa başına) ya da düz metne çevirebilirsiniz. Görsellerden yeni
bir PDF de oluşturabilirsiniz.

**Düzenle** — Büyük, yakınlaştırılabilir bir sayfa önizlemesi üzerinde
çalışan tek bir editör; üstteki mod düğmeleriyle ne yapacağınızı seçersiniz:
- **Metni Düzenle** (varsayılan) — mevcut bir paragrafın üzerine tıklayın,
  metni/boyutu/rengi/kalınlığı değiştirip kaydedin. Sarılmış (çok satırlı)
  bir paragrafsa tamamı birlikte seçilir. **Not:** orijinal font
  korunamaz, en yakın Helvetica ile değiştirilir.
- **Vurgula** — bir paragrafın üzerine tıklayın, seçili renkle anında
  vurgulanır (gerçek bir PDF vurgu/highlight işareti, metni değiştirmez).
- **Not Ekle** — bir konuma tıklayıp not metni yazın; küçük bir simge
  (sticky note) olarak eklenir, üzerine gelince notu gösterir.

Önizlemenin altındaki **−/%/+** düğmeleriyle yakınlaştırıp
uzaklaştırabilirsiniz. Sayfa seçimi yukarı/aşağı kaydırarak yapılır.

**Yeni metin/görsel eklemek veya yerleşimi tamamen değiştirmek
istiyorsanız** — PDF sabit-konumlu bir formattır, Word gibi otomatik
kaymaz/akmaz. Bunun yerine **Dönüştür** sekmesinden PDF'i Word'e çevirin,
orada normal bir Word belgesi gibi düzenleyin (metin/görsel eklemeleri
otomatik olarak diğer içeriği iter), sonra aynı sekmeden tekrar PDF'e
çevirin.

**Form Doldur** — PDF'te doldurulabilir form alanları (AcroForm) varsa
listelenir, değerleri girip kaydedebilirsiniz.

**AI ile Düzenle** — Ne yapmak istediğinizi düz yazıyla anlatın (ör.
"başlıkları kırmızı ve kalın yap", "2. sayfadaki fiyatları büyüt").
Model hangi satırların uyduğuna karar verip bir öneri listesi çıkarır;
istediğiniz maddeleri seçip onaylayana kadar HİÇBİR değişiklik
uygulanmaz.

## Sık sorulanlar

**"Geri Al" / "İleri Al" ile "Orijinale Dön" arasındaki fark ne?** —
"Geri Al"/"İleri Al" son değişiklikleri TEK TEK (bir yazılım editöründeki
Ctrl+Z gibi) geri alır/yeniden uygular. "Orijinale Dön" tüm geçmişi atlayıp
tek seferde PDF'i ilk yüklediğiniz hâline döndürür.

**PDF → Word neden bozuk çıkıyor?** — Bu yaklaşık bir dönüşümdür; karmaşık
düzenli (çok sütunlu, iç içe tablo) belgelerde biçim tam korunmayabilir.

**PDF → Excel'de sadece bazı satırlar geliyor?** — Bu özellik PDF'teki
TABLOLARI algılayıp aktarır; sayfada algılanan tablo yoksa düz metin tek
sütuna dökülür.

**PDF → PowerPoint'te metni düzenleyemiyorum?** — Bu yön her sayfayı
olduğu gibi bir GÖRSEL olarak slayta yerleştirir, metin düzenlenebilir
değildir — sayfaları sunum formatında yeniden kullanmak içindir.

**Taranmış (görüntü) PDF'lerde "Metni Düzenle" modu neden boş görünüyor?** —
Bu araç metni PDF'in kendi metin katmanından okuyor; sayfa bir görsel
olarak taranmışsa (OCR yapılmamışsa) çıkarılacak metin yok demektir.
