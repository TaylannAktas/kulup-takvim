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

### Vercel Cron zamanlaması (2026-09-04)
`vercel.json`'daki cron ifadeleri **UTC**'ye göre. Türkiye DST uygulamıyor, sabit
UTC+3 — bu yüzden "03:00 TR" = `0 0 * * *` (00:00 UTC), "03:15 TR" = `15 0 * * *`
(00:15 UTC), yıl boyu değişmeden geçerli. İki cron job da Vercel Hobby planının
sınırına tam oturuyor (plan free katmanda sınırlı sayıda cron destekliyor).

### Çakışma tespiti — kategori, sınır ve saat dilimi kuralları (Faz 3)
`club_events.conflict_flags` şekli spesifikasyondaki gibi
`{exam: [], holiday: [], event: []}`; her giriş `{id, label, detail}`. Anahtarlar
hiçbir zaman atlanmıyor (boş dizi yazılıyor) — arayüz doğrudan `.length` bakabilsin.

1. **Akademik takvimin `SINAV` kayıtları `exam` dizisine yazılıyor** (`TATIL` →
   `holiday`). Gerekçe: kullanıcı için anlam "bir sınav var/dönemi sürüyor";
   kaydın hangi tablodan geldiği değil. `exam_sessions` tek tek oturumları
   (AE111, 31 Ekim 15:30), akademik takvim ise geniş dönemleri ("Ara sınavlar",
   5-16 Ocak) temsil ediyor, ikisi de aynı uyarı kutusuna ait.
   `DERS_DONEMI`/`KAYIT`/`IDARI` çakışma üretmiyor — ders dönemi yılın çoğunu
   kaplar, uyarı gürültüye dönüşürdü.
2. **Sınırda dokunma çakışma sayılmıyor.** 16:00'da biten etkinlik 16:00'da
   başlayan sınavla çakışmaz (kesin `<`/`>`). Tüm gün süren akademik takvim
   kayıtlarında ise gün aralığı kapsayıcı (`<=`) — "1-5 Kasım tatili" 5 Kasım'ı
   da içerir.
3. **Saat dilimi:** duvar saatli kaynaklar (`exam_sessions`,
   `academic_calendar_entries`) `fromClubTime` ile UTC anına yükseltiliyor, sonra
   `club_events`'in timestamptz değerleriyle karşılaştırılıyor. Offset elle +3
   varsayılmıyor, IANA veritabanına soruluyor (Türkiye 2016'dan beri sabit UTC+3,
   ama 2016 öncesi arşiv verisi ve olası mevzuat değişikliği kendiliğinden doğru
   çalışsın diye).
4. **Sürücü tuzağı:** Postgres `date` sütunları (`mode: "date"`) neon
   sürücüsünden *süreç yerel saatinin gece yarısı* olarak geliyor
   ("2025-10-31" → UTC+3'te 2025-10-30T21:00Z). Yani takvim günü yerel
   getter'larla okunmalı, UTC getter'larıyla değil. Tersi yönde — `date`
   sütununa **yazarken** — Drizzle `toISOString()` çağırdığı için UTC gece
   yarısı bir Date verilmeli, yoksa tarih bir gün geriye kayar
   (bkz. `lib/calendar/day-notes.ts`).
5. **Cron'un yeniden hesaplaması `updated_at`'e dokunmuyor.** O alan iyimser
   kilit jetonu (§7.4); cron'un ilerletmesi, hiç kimse bir şey değiştirmediği
   halde açık formların "bu kayıt siz düzenlerken değişti" hatası almasına yol
   açardı. Sadece `conflict_flags` yazılıyor, o da JSON gerçekten değiştiyse.

### edupage gerçek yapısı — spesifikasyonun varsayımı geçersiz (2026-09-04)
Kullanıcının sağladığı gerçek "Web Sayfası, Tamamı" kaydı (`fixtures/edupage/sinif-programi-ornek.htm`,
Ankara-Gölbaşı / Atılım Üniversitesi, "Sınıflar" sekmesi, tek bir sınıfın haftalık programı):

**Spesifikasyonun varsaydığı** (`ttview`/`dbi`/`datarows` anahtarlı gömülü JSON) **yok.**
Sayfa artık React tabanlı bir görüntüleyici kullanıyor
(`a.renderRootComponent(gi1246,"/timetable/ttviewer.js#TTViewer",{"num":"18","user":"Trieda*305",...})`)
ve veri sayfa yüklendikten SONRA istemci tarafında ayrı bir istekle çekiliyor — düz
"Ctrl+S" kaydı bu isteğin sonucunu içermiyor (kaydedilen dosya sadece 157 satır,
tamamı sayfa iskeleti).

**Ama veri aslında kayıtta VAR — JSON değil, render edilmiş bir SVG grafiği olarak.**
Sayfa, programı bir Excel/PDF export'u gibi SVG `<rect>`/`<text>`/`<title>` öğeleriyle
çizip DOM'a gömüyor (aSc Ders Planlayıcı'nın kendi SVG render motoru). Bu, JSON
beklemekten daha kolay ayrıştırılabiliyor çünkü saat aralıkları ve gün etiketleri
sayıya değil, **metne** dönüşmüş durumda:

- Tek bir `<svg>` (sayfa sonundaki 1x1'lik ölçüm SVG'si hariç), içinde `<g transform="scale(...)">`
  altında tüm grid ölçeklenmemiş koordinatlarda çizili.
- **Saat başlıkları** (X ekseni): 12 adet dönem, her biri `<text>"1."</text>` +
  hemen ardından `<text>"9:30 - 10:20"</text>` gibi bir saat aralığı metni. Dönem
  sütun genişliği sabit (213.75 birim), ilk dönem x=345'te başlıyor. **Saatler
  sabit kodlanmıyor** — her dönemin gerçek başlangıç/bitiş saati doğrudan bu
  metinlerden okunuyor, bu yüzden okul dönem saatlerini değiştirse bile ayrıştırıcı
  kırılmaz.
- **Gün etiketleri** (Y ekseni): 6 satır, her biri 255 birim yükseklikte, y=420'de
  başlıyor: Pa/Sa/Ça/Pe/Cu/Cu. **KRİTİK TUZAK:** son iki satır da "Cu" — Cuma ve
  Cumartesi ikisi de bu 2 harfli kısaltmada aynı görünüyor, metinden ayırt
  edilemiyor. Çözüm: gün metnini hiç okuma, **satır sırasına güven**
  (firstDayOfWeek=1/Pazartesi olduğu ve Pazar hiç yer almadığı için sıra her zaman
  Pzt, Sal, Çar, Per, Cum, Cmt — 0-5 arası satır indeksi doğrudan haftanın günü).
- **Her ders oturumu**: renkli bir `<rect>` + hemen ardından aynı x/y/width/height'e
  sahip, `fill="transparent"` olan ikinci bir `<rect>`, içinde 3 satırlık bir
  `<title>`: `"KOD-SEC-NN-Ders Adı"` / `"Öğretmen1 / Öğretmen2"` (atanmamışsa "Staff")
  / `"Derslik"` (uzaktan dersler için "UZAKTAN", bazen sondan boşluklu). Konum: rect'in
  `x`'i hangi dönem sütununda başladığını, `width`'i kaç dönem sürdüğünü (örn.
  427.5 = 2 dönem, 641.25 = 3 dönem) verir; `y`'si hangi gün satırında olduğunu verir.
- Bu tek dosyada **22 ders oturumu** bulundu — tek bir sınıfın tam haftalık programı.

**Karar:** Birincil (ve şu an için TEK desteklenen) ayrıştırma stratejisi bu SVG
grid'ini okumak. Spesifikasyonun önerdiği "JSON önce dene, yoksa DOM tablosuna düş"
sırası artık geçersiz — gerçek kayıtta ne JSON ne düz `<table>` var. Gerçek bir DOM
`<table>` tabanlı örnek görülmediği için (belki eski bir edupage temasında olabilir)
kör bir "tablo geri düşüşü" yazılmıyor; SVG grid'i bulunamazsa ayrıştırıcı net bir
hata ile durur ("bu kaydın yapısı tanınmadı, geliştiriciyle iletişime geçin veya
farklı bir görünümden tekrar kaydedin") — tahmin yürütmek, sessizce yanlış
sınıf/oda okumaktan daha kötü.

**Kapsam dışı kalan alanlar:** `faculty_code`, `program_name`, `class_year` tek bir
sınıf görünümünden güvenilir çıkarılamıyor (sayfanın başlığı sadece "ACL 1" gibi kısa
bir sınıf adı veriyor, yapısal olarak bölünebilir değil). v1'de bu üç alan boş
bırakılıyor; içe aktarma ekranında kullanıcı isterse elle girebileceği bir form alanı
olabilir (Faz 4 kapsamına dahil edilmedi, gerekirse hızlı eklenebilir).

## Açık sorular

- ~~edupage.org sayfasının gerçek JSON blob yapısı henüz görülmedi~~ → **Karar (2026-09-04):**
  Kullanıcı gerçek bir "Web Sayfası, Tamamı" kaydı sağladı ve gerçek yapı spesifikasyonun
  varsaydığından TAMAMEN FARKLI çıktı. Bkz. aşağıdaki "edupage gerçek yapısı" bölümü —
  JSON blok yok, veri bir SVG grafiği olarak render edilmiş ve metin olarak (JSON'dan
  bile daha kolay) ayrıştırılabiliyor.
- Sınav programının **birden fazla dönem içinde sütun sırası gerçekten değişiyor mu**
  sorusu hâlâ açık (yukarıdaki karşılaştırma tek dönem içindeydi). Faz 2'de birkaç eski
  dönemin sheet001.htm'i karşılaştırılıp gerçek bir "order-b" fixture'ı bulunabilirse
  kullanılacak; bulunamazsa sentetik (elle sütun sırası değiştirilmiş) bir fixture ile
  test edilecek — gerçek örnek olmaması testin geçersizliği anlamına gelmiyor, sadece
  kaynağın söz konusu senaryoyu henüz üretmediği anlamına geliyor.
- Google Cloud OAuth istemcisi ve Neon projesi henüz kurulmadı (Faz 0, kullanıcı adımı).
- **Playwright e2e kapsamı Faz 3'te bilinçli olarak sınırlı** (`tests/e2e/auth.spec.ts`):
  gerçek bir Google hesabıyla giriş Faz 0 tamamlanmadan test edilemiyor, bu yüzden
  şimdilik sadece oturumdan bağımsız davranışlar test ediliyor (girişsiz erişim
  reddi, statik sayfa render'ı, cron/API kapıları). "Etkinlik oluştur" gibi gerçek
  oturum gerektiren akışlar için Faz 0 sonrası: ya gerçek bir test Google hesabıyla
  giriş yapılıp bir Playwright "storageState" kaydedilecek, ya da yalnızca test
  ortamında aktif olan bir NextAuth Credentials sağlayıcısı eklenip üretim
  yapılandırmasından tamamen ayrı tutulacak — hangisi seçilirse seçilsin, üretim
  auth mantığına (ALLOWED_EMAILS kontrolü dahil) dokunulmayacak.
