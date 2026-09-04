# Kararlar ve açık sorular

Spesifikasyonun (`PROJE-SPESIFIKASYONU.md`) belirsiz bıraktığı veya kodlamadan önce
doğrulanması gereken noktalar burada tutuluyor. Cevaplanınca "Karar" olarak işaretlenip
gerekçesi yazılıyor; hâlâ açıksa "Açık soru" olarak kalıyor.

## Kararlar

### GitHub / barındırma
Depo kişisel GitHub hesabında (TaylannAktas), **public** olarak açılacak. Vercel de bu
hesaba bağlanacak. (Kullanıcıyla plan onayı sırasında netleşti.)

### Veritabanı / ORM
Neon Postgres + Drizzle ORM. Gerekçe: Vercel entegrasyonu, hafiflik, hızlı prototipleme.
Prisma/Supabase spesifikasyonun önerdiği alternatiflerdi; değiştirme gerekçesi plan
dosyasında (`~/.claude/plans/merhaba-yeni-bir-projeye-vivid-minsky.md`) yazılı.

### Akademik takvim kaynağı — gerçek yapı doğrulandı (2026-09-04)
`https://www.atilim.edu.tr/tr/oim` üzerinden "Akademik Takvim" linki `/akademik-takvim`'e
gidiyor, oradan yıl bazlı sayfalara (`akademik-takvim-2026-2027` gibi) ulaşılıyor. **Önemli:**
yıl sayfası (`page/6946/...`) tablonun kendisini içermiyor — sadece program grubu linkleri
listeliyor:
- Önlisans/Lisans Akademik Takvimi (Tıp Fakültesi hariç) → `page/6951/...` **← bizim kapsamımız**
- Tıp Fakültesi Akademik Takvimi → `page/6953/...` (spesifikasyon zaten kapsam dışı diyor)
- Lisansüstü Programlar Akademik Takvimi → `page/6952/...`
- Azami Süre Ek Sınav Takvimi → `page/6981/...`

Yani kazıyıcının **iki aşamalı keşif** yapması gerekiyor: (1) yıl sayfasından
"Önlisans, Lisans Akademik Takvimi (Tıp Fakültesi hariç)" linkini metin eşleşmesiyle bul,
(2) o sayfayı çek. `page/6951/...` gibi sayısal ID'ler yıldan yıla değişeceği için sabit
URL değil, her seferinde yıl sayfasından keşfedilmeli.

Gerçek tablo yapısı `page/6951` üzerinde doğrulandı: `<ul class="nav nav-tabs">` (GÜZ
DÖNEMİ / BAHAR DÖNEMİ / YAZ ÖĞRETİMİ sekmeleri) + her biri için `<table><tbody><tr><td>`
yapısı, başlık satırı `SNO | BAŞLANGIÇ TARİHİ | BİTİŞ TARİHİ | AÇIKLAMA` — spesifikasyonla
birebir uyumlu. HTML entity kodlu Türkçe karakterler var (`&Ccedil;`, `&uuml;` vb.) —
cheerio bunları otomatik çözer, ek işlem gerekmiyor.

**Yeni bulgu — spesifikasyonda öngörülmemiş:** Tek günlük kayıtlarda boş hücre her zaman
BİTİŞ TARİHİ'nde olmuyor; gerçek veride BAŞLANGIÇ TARİHİ boş, BİTİŞ TARİHİ dolu satırlar da
var (örn. "Güz dönemi açılacak derslerin ... son günü" → başlangıç boş, bitiş `3 Temmuz
2026 Cuma`). **Karar:** ayrıştırıcı iki sütundan hangisi doluysa onu tek gün tarihi olarak
alacak; ikisi de doluysa aralık, ikisi de boşsa satır atlanıp uyarı loglanacak.

Boş hücreler `&nbsp;` olarak geliyor (gerçek boşluk değil) — trim sırasında ` ` da
whitespace sayılmalı.

### Sınav programı kaynağı — gerçek yapı doğrulandı (2026-09-04)
`https://www.atilim.edu.tr/tr/dersprogrami` sayfası "Sınav Programları" bölümünde
dönem/tür/fakülte bazlı linkler listeliyor, spesifikasyonla birebir uyumlu
(`https://dersprogramiyukle.atilim.edu.tr/{donem}{tur}/{fakulte}` deseni doğrulandı,
örn. `20252026guzarasinav/muh`).

Kök URL **301 redirect** veriyor — `curl -L` (veya fetch'te `redirect: "follow"`) şart,
aksi halde boş/yanlış içerik alınır.

Frameset yapısı doğrulandı: kök sayfa `<frameset><frame src="index_files/sheet001.htm"
name="frSheet"><frame src="index_files/tabstrip.htm" name="frTabs">` içeriyor — veri
`frSheet` çerçevesinde, `frTabs` sekme çubuğu (atlanmalı, spesifikasyonda zaten belirtilmiş).
`index_files/sheet001.htm` yolu kök URL'e göre relatif çözülmeli.

Gerçek sütun başlıkları (Mühendislik ve İşletme fakülteleri, 2025-2026 güz arasınav,
karşılaştırıldı — **aynı**): `Ders Kodu/Course Code | Dersin Adı/Course Name |
Sınıf/Classroom | Tarih/Date | Başlangıç Saati/Start Time | Bitiş Saati/End Time`.

**Yeni bulgular — spesifikasyonda öngörülmemiş:**
1. Ayrı bir "Bölüm/Section" veya "Derslik/Room" sütunu **yok**. `Sınıf/Classroom` alanı
   aslında oda/derslik numarasını taşıyor (örn. "2027") — veri modelindeki `room` alanına
   bu eşlenecek. `section` ayrı sütun değil; `course_code` içine gömülü olabilir
   (örn. "AE111-01" → ders kodu AE111, section 01). Ayrıştırıcı course_code'u
   `KOD-SECTION` deseniyle bölmeyi denemeli, bölünemezse section'ı boş bırakmalı.
2. `faculty_code` ve `exam_type` tablo içeriğinden değil, **kaynak URL'inden** türetiliyor
   (zaten spesifikasyonun URL desenine uygun) — tabloda bu bilgiler yok.
3. Başlık hücreleri satır içinde `<br>` ile bölünmüş olabiliyor
   ("Ders Kodu/Course<br>Code") — başlık normalize ederken newline/whitespace
   birleştirilmeli, yoksa "course code" gibi bir dize aranırken eşleşme kaçabilir.
4. Tarih formatı burada **`DD.MM.YYYY`** (örn. "31.10.2025") — akademik takvimin Türkçe
   tam tarih formatından (`14 Eylül 2026 Pazartesi`) tamamen farklı. İki kaynağın tarih
   ayrıştırıcıları ayrı fonksiyonlar olmalı, ortak bir "akıllı" tarih ayrıştırıcı riskli.
5. Aynı dönem içindeki farklı fakülteler arasında sütun sırası **aynıydı** (Mühendislik ve
   İşletme karşılaştırıldı) — spesifikasyonun uyardığı "fakülteden fakülteye değişebilir"
   riski bu iki örnekte gözlenmedi, ama dönemler arası (Excel şablonu yıl yıl elle
   hazırlandığı için) değişebilir; yapısal tespit + elle eşleme geri düşüşü yine de
   gerekli, sadece "her fakülte farklı" varsayımıyla aşırı karmaşık bir eşleyici
   kurmaya gerek yok.

### Sınav programı kazıyıcısı — kodlama sırasında çıkan ek bulgular (2026-09-04)
Fixture'lar üzerinde çalışırken yukarıdaki analizde görünmeyen dört nokta çıktı:

1. **Saat biçimi her zaman `HH:MM` değil.** Gerçek veride nokta ayraçlı saatler de
   var (`CE 417-01` satırı: `13.30` / `16.00`). Aynı sınav farklı hash üretmesin diye
   ayrıştırıcı `[:.]` ayracını kabul edip hepsini `HH:MM` biçimine normalleştiriyor.
2. **Ders kodu bölme regex'i tireyi zorunlu tutmalı.** `CE 406` gibi sonu rakamla
   biten kodlar var; gevşek bir desen bunu "CE 4" + "06" diye bölerdi. Tire yoksa
   `section` boş bırakılıyor, ders kodundaki iç boşluk korunuyor (`CE 417-01` →
   `CE 417` + `01`).
3. **`source_hash` alan listesine `section` eklendi (spesifikasyondan sapma).**
   Aynı dersin farklı şubeleri aynı gün, aynı saatte, aynı odada sınava giriyor
   (`AE307-01/-02/-03`). Section hash'e girmezse Mühendislik güz arasınavında 298
   satır 224'e düşüyor — 74 kayıt sessizce yutuluyor. Şube, kaydın kimliğinin parçası.
4. **Keşif sayfasındaki URL desenleri tek tip değil.** `{donem}{tur}/{fakulte}`
   dışında `{tur}{donem}/{fakulte}` sıralaması (`20232024arasinavbahar/muh`), sınav
   türü içermeyen ders programı bağlantıları (`20252026guz/pilotaj`) ve eski/farklı
   fakülte kısaltmaları (`muhendislik`, `müh`, `sbf`, `myosaglik`) var. **Karar:**
   iki sıralama da aynı `termCode`'a indirgeniyor (`20232024bahar`); sınav türü
   içermeyen bağlantılar ve spesifikasyonun kısaltma listesinde olmayan fakülteler
   eleniyor (v1 kapsamı).

**Kayıtlı elle sütun eşlemesi deseni (`source_column_mapping.source_url_pattern`):**
önce tam URL (`https://dersprogramiyukle.atilim.edu.tr/20252026guzarasinav/muh`),
bulunamazsa fakülte bazlı genel desen (`dersprogramiyukle.atilim.edu.tr/*/muh`)
aranıyor. Gerekçe: bozukluk genelde tek bir dönem sayfasına özgü, ama bir fakülte
şablonunu kalıcı olarak farklı tutuyorsa her dönem yeniden elle eşleme yapılmasın.

## Açık sorular

- edupage.org sayfasının gerçek JSON blob yapısı henüz görülmedi — Faz 4'te kullanıcıdan
  gerçek bir kaydedilmiş HTML örneği istenecek (manuel adım, spesifikasyon §4.3).
- Sınav programının **birden fazla dönem içinde sütun sırası gerçekten değişiyor mu**
  sorusu hâlâ açık (yukarıdaki karşılaştırma tek dönem içindeydi). Faz 2'de birkaç eski
  dönemin sheet001.htm'i karşılaştırılıp gerçek bir "order-b" fixture'ı bulunabilirse
  kullanılacak; bulunamazsa sentetik (elle sütun sırası değiştirilmiş) bir fixture ile
  test edilecek — gerçek örnek olmaması testin geçersizliği anlamına gelmiyor, sadece
  kaynağın söz konusu senaryoyu henüz üretmediği anlamına geliyor.
- Google Cloud OAuth istemcisi ve Neon projesi henüz kurulmadı (Faz 0, kullanıcı adımı).
