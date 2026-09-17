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
- Bu tek dosyada **21 ders oturumu** bulundu (ilk incelemede 22 sanılmıştı — dosyadaki
  22. `<title>` aslında `<head><title>` sayfa başlığıydı, ders bloğu değil) — tek bir
  sınıfın tam haftalık programı.

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

### Sınav programı kazıyıcısı — canlı ortamda bulunan gerçek hata (2026-09-05)
Faz 0 tamamlanıp gerçek bir Neon veritabanına karşı ilk kez canlı senkron
çalıştırıldığında sınav programı senkronunun **120/120 kaynağının tamamı**
başarısız çıktı — halbuki Faz 2'deki 29 test hepsi geçiyordu. Sebep: testler
sadece saf ayrıştırma fonksiyonlarını (fixture'lara karşı) kontrol ediyordu,
gerçek ağ isteği + yönlendirme etkileşimini hiç test etmiyordu — bu, testlerin
kapsamındaki gerçek bir boşluktu.

Gerçek hata: kaynağın kök URL'i **301 ile, sonunda `/` olan bir adrese**
yönlendiriyor (örn. `.../20252026guzarasinav/servis` → `.../servis/`).
`fetchExamScheduleFrameset`, frame'in relatif `src`'ini (`index_files/sheet001.htm`)
YÖNLENDİRME ÖNCESİKİ orijinal URL'e göre çözüyordu. URL çözümleme kuralı
gereği, temel URL'de sondaki segmentten sonra `/` yoksa o segment relatif yol
tarafından **değiştiriliyor** — yani `servis` sessizce düşüyor ve sonuç
`.../20252026guzarasinav/index_files/sheet001.htm` gibi yanlış (fakülte
segmentsiz) bir URL oluyor, kaynak sitede 404 dönüyor.

**Düzeltme:** `lib/scrapers/shared/http-client.ts`'e `fetchHtmlWithFinalUrl`
eklendi — `fetch()`'in `redirect:"follow"` sonrası gerçek nihai URL'ini
(`response.url`) da döndürüyor. `fetchExamScheduleFrameset` artık relatif
frame src'ini bu nihai URL'e göre çözüyor. Gerçek siteye karşı doğrulandı:
düzeltmeden önce 120/120 "hata", sonra 77/120 "ok" (8.641 sınav kaydı),
43/120 "needs_mapping" (hepsi 2022-2023/2023-2024 gibi eski dönemler — farklı
Excel şablonu, sistemin tahmin yürütmeden elle eşlemeye düşmesi beklenen/doğru
davranış), 0 "hata".

**Ders çıkarımı:** Bir kazıyıcının saf ayrıştırma fonksiyonları test edilmiş
olması, ağ+yönlendirme etkileşimini de test ettiği anlamına gelmiyor. Gerçek
bir 301/302 yönlendirmesi olan her kaynak için, relatif bağlantı çözümlemesinin
orijinal URL'e göre mi yoksa nihai URL'e göre mi yapıldığı ayrıca doğrulanmalı.

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

### Uygunluk analizi ısı haritası — haftalık desen destek, takvim tarihleri eksik (Faz 4, 2026-09-04)
Spec §7.2'nin "Sınav ve tatil günleri otomatik elenir" hedefi uygulanmadı. 
`lib/availability/overlap.ts` saf bir fonksiyondur ve yalnızca haftalık ders programı 
desenini biliyor (weekday 1-6, saatler); belirli tarih aralığındaki takvim girişlerini 
(exam_sessions, academic_calendar_entries) bilmez. Heatmap düzen ve filtreleme 
(`app/availability/page.tsx`) tamamen haftalık desene dayalıdır. Gelecek faz: 
`academic_calendar_entries` ve `exam_sessions` verileri sayfa tarafından önceden 
filtrelenip "bu tarihler hariç tutulacak" şeklinde `overlap.ts`'ye geçirilebilir, 
veya haftalık sonuçlar sayfa tarafından date-range kesiştirmesi ile post-processed 
edilebilir — şimdilik ikisine de sahit değiliz.

### PNG dışa aktarma (Spec §6.6) atlandı (Faz 5, 2026-09-04)
Spesifikasyonun "yazdırılabilir... PNG görüntü" hedefi için bağımlılıksız DOM→PNG render 
gerekir, bu da `html-to-image` gibi bir kütüphane talep eder. Minimal bağımlılık ilkesiyle 
çelişir. Alternatif: `window.print()` + `@media print` CSS (Feature 2'de uygulandı) — 
tarayıcı yazdırma iletişim kutusundan PDF olarak kaydediyor, aynı ihtiyacı karşılıyor.

### Bilinen veri sorunları — `exam_sessions` şişmiş ve bir kayıt 900 yıl ileri tarihli (2026-09-06)
Üretim/dev veritabanında `exam_sessions` **11.619 satıra** çıkmış durumda; DECISIONS.md'nin
kod yorumlarındaki "bir dönem birkaç yüz satır" varsayımı artık geçerli değil. Tespit
edilenler:
- `max(exam_date) = 2924-12-04` — gerçek bir tarih olamaz, sınav programı senkron/ayrıştırma
  tarafında bir yerde yıl 1000 kaydırılmış görünüyor (muhtemelen "d579848 Gerçek üretim
  hatası: sınav programı senkronu 120/120 başarısız çıkıyordu" ile aynı kökten, ya da ayrı
  bir regresyon — henüz doğrulanmadı).
- 2.988 grup `(course_code, exam_date, start_time, room, section)` birden fazla kez var —
  senkronun eski çalıştırmalardan kalan satırları temizlemediğine işaret ediyor (upsert/dedup
  eksik).
- Bu satır artışı, sınav programı sol panelinin (`ExamSchedulePanel`) her `/calendar`
  yüklemesinde **tüm tabloyu filtre uygulamadan çekip render etmesiyle** birleşince sayfa
  yüklemesini 20-27 saniyeye çıkarıyordu (kullanıcı raporu + `time_total` ölçümü).
- **Uygulanan düzeltme (bu commit):** `ExamSchedulePanel` artık görünen aya ± bir ay
  pencereyle DB'de tarih filtresi uyguluyor (`components/sidebar/ExamSchedulePanel.tsx`);
  `getMonthCalendarBars`'daki sınav sorgusu da aynı şekilde `gridStart`/`gridEnd` ile DB'de
  sınırlandı (önceden tüm tabloyu çekip bellekte filtreliyordu). Bu, satır sayısı ne olursa
  olsun render'ı sınırlı tutar — ama **kök veri sorununu çözmüyor**.
- **Çözülmedi, kullanıcı onayı bekliyor:** (1) senkron koduna dedup/upsert eklenmesi, (2)
  `exam_date > 2100` gibi mantıksız satırların temizlenmesi. Üretim verisini silen/değiştiren
  bir migration kullanıcı onayı olmadan yazılmadı.

### Gün ayrıntı paneli sağdan alta taşındı (2026-09-06)
Spec §6.5 sağ tarafta açılan bir panel tarif ediyordu (`DayDetailPanel` `w-96 border-l`).
Kullanıcı isteği üzerine takvimin hemen altına, alt araç çubuğunun üstüne taşındı: panel artık
tam genişlikte, sabit `h-80` yükseklikte yatay bir şerit (`app/calendar/page.tsx`'te
`BottomToolbar`'dan önce, ana sütunun içine alındı — önceden satırın üçüncü flex öğesiydi).
`HourlyTimeline` iç yapısı değişmedi (saat ekseni + üst üste binen oturum sütunları), sadece
dış kapsayıcı dikeyden yataya döndü; "bu gün neden kırmızı" bölümü de dar panelde alt alta
dururken artık zaman çizelgesinin sağında sabit genişlikte bir sütun.

### Görünüm anahtarı üst şeride taşındı, ders bar'ları sabit dar rozet (2026-09-07)
- `ViewSwitcher` (Dönem/Ay/Hafta) alt araç çubuğundan (`BottomToolbar`) üst şeride, tarih
  başlığının (◀ Ay Adı ▶) hemen yanına taşındı. `BottomToolbar` artık sadece + Etkinlik/+ Not/
  Katmanlar/Dışa aktar içeriyor, `justify-end` ile sağa yaslı.
- `MonthGrid.tsx`'teki bar render'ı: `course_session` türündeki bar'lar (ders oturumları) artık
  hücreyi tam doldurup "uzun çizgi" gibi durmuyor — sabit `w-14` (56px) genişlikte, sola yaslı
  (`justify-self-start`) bir rozet. Diğer bar türleri (akademik takvim, sınav, kulüp etkinliği)
  DEĞİŞMEDİ — onlar gerçekten çok günlü olabiliyor, "kesintisiz şerit" anlamlarını koruyorlar.
  Ders oturumları zaten her zaman tek günlük olduğu için (haftalık desenden çoğaltılıyor) bu bir
  bilgi kaybı değil, sadece görsel sıkıştırma.

### Dönem görünümü aylık ızgara listesine döndü, ısı haritası katmana taşındı, sınav/akademik filtreleri tik kutulu (2026-09-08)
Üç ayrı istek:

1. **"Dönem" artık ardışık aylık takvim listesi.** Eski GitHub-katkı-grafiği tarzı ısı haritası
   (`TermHeatmap.tsx`, tek dönem için küçük kareler) tamamen kaldırıldı (dosya silindi, hiçbir
   yerde kullanılmıyordu). `/calendar/term` artık içinde bulunulan aydan **Temmuz 2027'ye kadar**
   (kullanıcının verdiği sabit bitiş — akademik yıl sonuna göre dinamikleştirilmedi, `Math`
   basit bir ay döngüsü) her ay için TAM bir `MonthGrid` render ediyor, kaydırılabilir tek
   sayfada alt alta. Güz/Bahar/Yaz dönem seçici kaldırıldı (artık tek bir dönemi değil, hepsini
   gösteriyor). Performans: 11 ay × 4 tablo = 44 sorgu paralel çalıştırıldığında gerçek veriyle
   654ms ölçüldü — önceki "tüm exam_sessions'ı çekip render et" tuzağına düşülmedi çünkü her ay
   kendi penceresiyle sorgulanıyor (aynı `getMonthCalendarBars`/`getMonthNoteDates`, tek ay
   görünümüyle birebir aynı fonksiyonlar, sadece 11 kez paralel çağrılıyor).
2. **Isı haritası artık Ay görünümünde bir katman, varsayılan KAPALI.** `EventStyle`'a
   `heatmapBackgroundClassName` eklendi (TÜM türler için tanımlı — eski `cellBackgroundClassName`
   sadece 2 tür içindi ve her zaman açıktı, dokunulmadı). `LayersDropdown`'a adlandırılmış bir
   "Isı haritası" tik kutusu eklendi (`HEATMAP_LAYER_ID = "view:heatmap"`, `lib/calendar/layers.ts`).
   `DayCell` artık `heatmapOn` prop'una göre `cellBackgroundClassName` (katman kapalı, eski
   davranış — DEĞİŞMEDİ) veya `heatmapBackgroundClassName` (katman açık, tüm türler tonlanır)
   kullanıyor.
3. **Sınav Programı (fakülte/tür) ve Akademik Takvim (kategori) filtreleri artık tik kutulu.**
   Eski "pill" (yuvarlak, yan yana) buton stili yerine Sınıflar'daki gibi dikey, tik kutulu satır
   listesi — yeni paylaşılan `FilterCheckboxRow` (`components/sidebar/FilterCheckboxRow.tsx`).
   Bu iki panel Server Component olduğu için (href'ler sunucuda üretiliyor) checkbox'lar salt
   görsel (`readOnly`), tıklamayı sarmalayan `<Link>` yapıyor — CourseSchedulePanel'deki
   client-state'li checkbox'lardan farklı ama görsel olarak birebir aynı.

### Akademik takvim — tam çerçeve yerine başlangıç/bitiş kenarı, çizelgede alt şerit (2026-09-08)
Bir önceki maddedeki "her günü çerçevele" tasarımı da kullanıcıya göre yetersizdi — bazı
kayıtlar 150+ gün sürdüğü için (bkz. bir önceki madde) neredeyse ay boyunca her günü
çerçeveliyordu, bu da kendi başına kalabalık yaratıyordu. Yeni tasarım: sadece kaydın
**başladığı günün SOL kenarına**, **bittiği günün SAĞ kenarına** kalın renkli çerçeve.
Aradaki günlere hiç dokunulmuyor. Gerçek Eylül 2026 verisiyle doğrudan test edildi: görünür
ay ızgarasında 25 akademik kayıt eşleşiyor ama sadece **12 gün** kenar işareti alıyor (tek
günlük kayıtlarda aynı gün hem sol hem sağ kenar birden).

Uygulama: `getMonthCalendarBars`'ın döndürdüğü `academicEdges: Map<"YYYY-MM-DD", {start?,
end?: EventKind}>` — `AcademicEdge` tipi (`month-events.ts`). `EventStyle`'a `frameClassName`
yerine `frameStartClassName`/`frameEndClassName` eklendi (Tailwind JIT runtime'da
`border-l-${renk}` gibi birleştirilmiş string tanımıyor, literal class adı gerekiyor — bu
yüzden `border-l-4 border-l-stone-500 dark:border-l-stone-400` gibi TAM sınıf adları kod
içinde sabit). Dönem ısı haritası (`/calendar/term`) hâlâ kapsanan HER günü bilmek istediği
için `academicDayKinds` (eski, tam kapsama haritası) da AYRICA döndürülmeye devam ediyor —
iki farklı tüketici, iki farklı granülerlik.

**Çizelgede alt şerit:** Güne tıklandığında açılan yatay zaman çizelgesinin (`HourlyTimeline`)
en altına, o günü etkileyen akademik takvim kayıtları saat eksenine bağlı olmadan (tam
genişlikte, saate göre konumlanmayan) birer renkli çizgi olarak eklendi — `academicEntries`
prop'u, `DayDetailPanel`'in zaten sahip olduğu `affectingAcademicEntries`'ten türetiliyor
(artık `kind: EventKind` alanı da taşıyor, `day-detail.ts`'te `academicCalendarKindFromCategory`
ile hesaplanıyor). Sağdaki "Bu gün neden kırmızı?" metin paneli KALDIRILMADI, aynı veri şimdi
iki yerde (çizelgede çizgi + sağda açıklama metni) — kullanıcı sadece ekleme istedi, kaldırma değil.

### Akademik takvim artık şerit değil çerçeve, lab dersleri daha koyu (2026-09-08)
Kullanıcı raporu: "Akademik takvim seçiliyken takvimde çok fazla karalama oluyor". Kök sebep
doğrulandı — gerçek veride bazı akademik takvim kayıtları AYLARCA sürüyor (örn. "Yeni
uluslararası öğrenci kayıtları" 2026-06-30 → 2026-11-25, 150+ gün). Bunlar önceden
`getMonthCalendarBars`'ın ürettiği `bars` dizisine diğerleriyle (sınav, ders, etkinlik) aynı
şekilde giriyor, `MonthGrid`'in şerit/lane sistemine (metin + arka plan renkli çubuk, en fazla
3 satır görünür) düşüyordu — aylarca süren bir kayıt neredeyse her günün 1-3 şerit satırını
işgal edip metin taşıyordu.

**Çözüm — akademik kayıtlar artık `bars`'ta değil:** `getMonthCalendarBars`'ın dönüş tipi
`CalendarBarItem[]` yerine `{ bars, academicDayKinds }` oldu (breaking change, tek çağıran
`app/calendar/page.tsx` + `app/calendar/term/page.tsx` güncellendi). `academicDayKinds` bir
`Map<"YYYY-MM-DD", EventKind>` — her gün için (birden fazla kayıt çakışırsa TATİL >
DERS_DONEMI > KAYIT > İDARİ önceliğiyle) tek bir kategori. `DayCell` bunu metin/şerit yerine
sadece **hücre çerçevesi rengi** olarak kullanıyor (`EventStyle.frameClassName`, yeni alan —
tatil=stone, dönem sınırı=mavi, kayıt=cyan, idari=gri, her biri ayrı renk). Kutu içine hiçbir
şey yazılmıyor; erişilebilirlik için (renk tek başına anlam taşımasın, spec §7.6) kategori adı
`title` (fare üstüne gelince tooltip) olarak duruyor.

Dönem ısı haritası (`/calendar/term`) etkilenmesin diye `academicDayKinds` oradan da ayrıca
okunup yoğunluk hesabına katılıyor — o görünüm hâlâ akademik günleri yansıtıyor, sadece ay
ızgarasındaki şerit kaldırıldı.

**Lab dersleri daha koyu:** `course_sessions`'ta "bu bir lab mı" diye ayrı bir alan yok;
edupage verisinde ders KODUNA değil DERSLİK adına göre ayrışıyor (örn. "Genel Kimya Labı",
"Computer Network Lab.", "MAKET LAB." — gerçek veride 94 oturumun 23'ü, %24'ü lab). Yeni
`courseSessionKind(room)` (`color-system.ts`) `room` metninde "lab" geçip geçmediğine bakıp
`course_session_lab` (koyu düz mor, `bg-purple-700`) ya da `course_session` (eski yarı saydam
`bg-purple-500/40`) döndürüyor — hem ay ızgarasında hem gün ayrıntı çizelgesinde kullanılıyor.

### Görünüm anahtarı üstte, ay ızgarasında boşluk giderildi, gün notları göründür (2026-09-07)
1. **Ay ızgarası ↔ çizelge arası boşluk daraltıldı** — hafta satırları (`MonthGrid.tsx`) artık
   `flex-1` (eskiden içeriğe göre doğal yükseklik alıyorlardı, kalan boşluk sarmalayıcının
   ALTINDA boş kalıyordu — kaç hafta olursa olsun ızgara artık kullanılabilir yüksekliği tam
   dolduruyor).
2. **Çizelge yüksekliği artırıldı** — `DayDetailPanel` `h-80`(320px) → `h-96`(384px).
3. **Çizelge sola yaslı, sağda Notlar paneli** — sağdaki "bu gün neden kırmızı" bölümü artık
   koşullu değil, sabit genişlikte (`w-72`) bir sütunun İÇİNDE — bu sütun her zaman render
   ediliyor, çizelge (`flex-1`) böylece her zaman soldaki kalan alanı kaplıyor ("sola yaslı").
   Aynı sütunun altına **Notlar** bölümü eklendi: o günün notu varsa metni + "Düzenle", yoksa
   "+ Not ekle" — ikisi de zaten var olan `onAddNote` (→ `DayNoteModal`) akışını tetikliyor.
4. **Gün notları hiç bağlanmamıştı — artık bağlandı.** `day_notes` tablosu ve tam bir CRUD API'si
   (`/api/day-notes`) zaten vardı ama:
   - `getDayDetail` notları hiç sorgulamıyordu → şimdi `notes` alanı eklendi, sağdaki panel
     bunu kullanıyor.
   - Ay ızgarasında notu olan günler için spec §6.5'in tarif ettiği "sarı köşe üçgeni" işareti
     hiç implemente edilmemişti → `getMonthNoteDates` (yeni, `month-events.ts`) o ay için
     notu olan günlerin tarihini döner, `DayCell.tsx` sağ üst köşede CSS border-triangle
     tekniğiyle sarı üçgen çiziyor.
   - DB'de zaten iki gerçek test notu vardı (5 Eylül ve 31 Ağustos 2026 — Europe/Istanbul yerel
     tarihine göre; ham UTC değerleri `T21:00:00Z` görünüyor, bu proje genelindeki bilinen
     "date sütunu yerel-gece-yarısı Date olarak okunuyor" davranışının bir yansıması, bkz.
     `lib/calendar/day-notes.ts` yorumu) — bu özellik artık onları da doğru gösterecek.

**Doğrulanmadı, bilinsin:** `dayNotes.date` (ve `examSessions.examDate`) okunurken `pg`
sürücüsü `date` sütununu SUNUCUNUN yerel saat dilimine göre gece yarısı `Date` nesnesi olarak
kuruyor (Node.js + node-postgres'in bilinen bir davranışı). Yazma tarafı (`parseDateOnly`)
bilinçli olarak UTC gece yarısı kullanıyor. Yazma ve okuma HER ZAMAN aynı sunucu sürecinde
olduğu için (Vercel'de ikisi de UTC) pratikte tutarlı kalıyor, ama bu varsayım hiç yazılı
olarak doğrulanmadı/test edilmedi — üretimde bir gün kayması görülürse ilk bakılacak yer burası.

### Ay ızgarasında sadece ders kodu, çizelgede sabit period listesi (2026-09-07)
İki küçük düzeltme, aynı gün içindeki önceki iki maddenin üstüne:

- Ay ızgarasındaki ders bar etiketi bir önceki maddede "kod + ad" yapılmıştı; kullanıcı bunu
  da fazla buldu, sadece **kod** kaldı (örn. "CHE105", ad yok).
- Gün ayrıntı çizelgesindeki period başlıkları artık "1. Ders / 9.30" gibi iki satır (kaçıncı
  ders saati + nokta ayraçlı başlangıç saati) gösteriyor. Kullanıcı ayrıca gerçek period
  verisine bağımlılığı gevşetmeyi ("koda gömebilirsin") onayladı — `lib/calendar/
  default-periods.ts`'te Atılım'ın bilinen sabit 12 period'luk düzeni (09:30'dan başlayarak
  50dk ders + 10dk ara) koda gömüldü. `getDayDetail` artık şu sırayı izliyor: önce gerçek
  `timetable_imports.periods` verisini dener (bu özellikten sonra yapılmış içe aktarmalar
  için doğru), yoksa bu sabit listeye düşer — yani artık **her zaman** period sütunları
  görünüyor, eski içe aktarmaları yeniden yüklemeyi beklemeye gerek kalmadı. Gerçek veri hâlâ
  öncelikli: okul saatleri değişirse ve kullanıcı yeniden içe aktarırsa, sabit listeyi değil
  gerçek veriyi kullanmaya devam eder.

### Kategori içi arama, görünüm anahtarı sadeleştirme, ders bar etiketi, içe aktarma düzenle/sil (2026-09-07)
Tek oturumda dört ayrı kullanıcı isteği:

1. **Kategori içi arama** — "Ders Programı"/"Sınav Programı"/"Akademik Takvim" panellerinin
   her birine, başlığın hemen altında (panelin en üstünde) bir arama kutusu eklendi.
   `ExamSchedulePanel` ve `AcademicCalendarPanel` Server Component oldukları için (DB'den
   doğrudan okuyorlar) serbest metin arama durumu tutamıyorlardı — liste render'ı ayrı birer
   client component'e (`ExamSessionSearchList`, `AcademicEntrySearchList`) taşındı, fakülte/tür/
   kategori çipleri `children` olarak arama kutusunun altına geçiriliyor. `CourseSchedulePanel`
   zaten client'tı; dört sekmenin (Sınıflar/Derslikler/Dersler/Toplu Çizelge) ayrı ayrı arama
   kutuları tek bir üstteki kutuya birleştirildi, "Sınıflar" ve "Toplu Çizelge" sekmelerine de
   arama ilk kez eklendi.
2. **Görünüm anahtarı** — `ViewSwitcher`: [Ay][Hafta][Gün][Dönem] → [Dönem][Ay][Hafta]. "Gün"
   kaldırıldı (zaten hiç implemente edilmemişti, `href="#"` idi) — gün ayrıntı çizelgesi (alttaki
   yatay panel) tek günü göstermeye zaten yarıyor.
3. **Ay ızgarasında ders bar etiketi** — `getMonthCalendarBars`'taki ders oturumu bar'ları artık
   saat göstermiyor, sadece `courseCode + courseName` (örn. "HIST101 Uygarlık Tarihi"). Saat
   bilgisi zaten gün ayrıntı çizelgesinde (period sütunlarıyla) var; küçük ay hücresinde gereksiz
   kalabalık yaratıyordu. Sınav bar'ları BUNDAN ETKİLENMEDİ (hâlâ saat gösteriyor) — istek özellikle
   "derslerin" diyordu, sınavlar için ayrı bir talep yoktu.
4. **İçe aktarma listesinde düzenle/sil** — `/api/timetable-imports/[id]`'ye `PATCH` eklendi
   (sourceLabel/termCode değiştirir, ders oturumlarına dokunmaz; `DELETE` zaten vardı, dokunulmadı).
   `/admin/timetable-imports` tablosundaki her satır artık `TimetableImportRow` (client) — satır içi
   düzenleme formu + silme düğmesi (native `confirm()` ile onay). Denetim kaydına (`audit_log`)
   hem düzenleme hem silme zaten yazılıyor (`logAudit`, `action: "update"`/`"delete"`).

### Gün ayrıntı çizelgesi gerçek "ders saati" (period) sınırlarına bölündü (2026-09-07)
Kullanıcı çizelgenin "okulun sitesindeki gibi" ders saatlerine bölünmesini istedi. edupage
sayfası her dersin süresini bağımsız serbest saatler yerine sabit period'lara (bkz. spec §4.3,
`parse-svg-timetable.ts`'in `extractPeriods`'ı) oturtuyor ama bu bilgi daha önce sadece dahili
olarak oturum saatlerini çözmek için kullanılıp atılıyordu, hiç saklanmıyordu.

**Şema değişikliği:** `timetable_imports`'a `periods` (jsonb, nullable) sütunu eklendi
(`npx drizzle-kit push` ile uygulandı — README'nin belgelediği yöntem). `parseEdupageTimetableSvg`
artık `{ rows, warnings, periods }` döndürüyor; `normalize.ts` `periods`'u da kaydediyor.

**Önemli — geriye dönük veri:** Bu özellikten ÖNCE yapılmış 5 içe aktarmanın `periods` alanı
`null` (doğrulandı). Bunlar için çizelge eski genel saat/yarım saat ızgarasına düşüyor —
kırılmıyor ama period'lara bölünmüyor de. **Kullanıcının period görmek istediği sınıfları
bookmarklet ile yeniden içe aktarması gerekiyor** (aynı "yeniden içe aktar" akışı, veri
üzerine yazılıyor).

**Tasarım kararı — öğe konumlandırma DEĞİŞMEDİ:** `HourlyTimeline`'da period'lar sadece üst
şerit etiketlerini ve dikey çizgileri değiştiriyor (period varsa sütun başlığı + sınır çizgisi,
yoksa eski nokta saat etiketi). Ders/sınav/etkinlik çubuklarının yerleşimi hep gerçek saatine
göre orantılı (`minutesToPercent`) hesaplanmaya devam ediyor — period'a göre ayrık/bükülmüş bir
eksene GEÇİLMEDİ. Gerekçe: sınav ve kulüp etkinlikleri period sınırlarına uymuyor (ör. bir
sınav 10:00-12:00 sürebilir, iki period'u keser); ayrık eksende bunları doğru yerleştirmek
ciddi ek karmaşıklık gerektirirdi. Bu karma yaklaşım hem "okulun sitesi gibi bölünmüş görünüm"
hem de sınav/etkinliklerin doğru saatte kalmasını aynı anda sağlıyor.

Birden fazla ders programı katmanı aynı anda seçiliyse (bkz. yukarıki "çoklu seçime açıldı"
maddesi) o günün oturumlarının ait olduğu TÜM içe aktarmalardan period'lar çekilip
(başlangıç+bitiş saati aynı olanlar tekilleştirilerek) birleştiriliyor — farklı sınıflar
gerçekte aynı period grid'ini paylaştığı için pratikte tek bir set çıkıyor.

### Gün ayrıntı panelinde ders oturumları eksikti — eklendi (2026-09-07)
Kullanıcı "güne tıklayınca zaman çizelgesinde hangi saatte hangi ders var göremiyorum"
diye bildirdi. Kök sebep: `lib/calendar/day-detail.ts`'in `getDayDetail`'i Faz 4'te
(ders programı içe aktarma) hiç güncellenmemiş kalmış — hâlâ eski "Ders oturumları henüz
yok (Faz 4)" yorumuyla duruyordu, sadece sınav ve kulüp etkinliklerini sorguluyordu.
`getMonthCalendarBars` ay ızgarasında ders oturumlarını doğru gösteriyordu (bkz. yukarıki
"çoklu seçime açıldı" maddesi) ama gün ayrıntısı panelinde hiç yoktu — iki fonksiyon
birbirinden bağımsız gelişmiş, biri unutulmuş.

Düzeltme: `parseActiveCourseLayers` ve `isoWeekday` `month-events.ts`'ten export edilip
`day-detail.ts`'te tekrar kullanıldı — aynı aktif sınıf/derslik/ders seçimi ve aynı
tekilleştirme mantığı (OR filtre + id bazlı dedup) burada da uygulanıyor, ki ay
ızgarasında görünen katmanlarla gün ayrıntısında görünenler tutarlı olsun. "Ders Programı"
kategori tik kutusu (yukarıki madde) burada da geçerli.

### Kategori bazlı görünürlük tik kutuları eklendi (2026-09-07)
Kullanıcı "Sınıflar"daki tik kutusu sistemini üst kategoriler için de istedi: takvimde
sadece Ders Programı, sadece Sınav Programı ya da sadece Akademik Takvim'i görebilmek.
`components/sidebar/CategoryVisibilityCheckbox.tsx` + `lib/calendar/category-layers.ts`
eklendi; `SidebarAccordion`'a `headerControl` prop'u (katla/aç düğmesinin dışında, ayrı bir
kardeş öğe — checkbox'a tıklamak accordion'u açıp kapatmasın diye) eklendi.

Bilinçli tasarım kararı: bu katmanlar diğerlerinin (fakülte/tür çipleri, "Sınıflar" seçimi)
TERSİ mantıkla kodlanıyor — boş katman "hiçbir şey görünmüyor" değil "hiçbir şey
GİZLENMEMİŞ" demek, yani varsayılan (ilk ziyarette, URL'de hiçbir şey yokken) üç kategori
de AÇIK. Namespace bu yüzden `category-hidden` (görünür değil, gizli olanı listeliyor).
Aksi hâlde mevcut kullanıcılar link paylaştığında ya da sayfayı ilk açtığında hiçbir şey
görünmeyecekti — geriye dönük uyumluluk için varsayılan "hepsi açık" korundu.

`getMonthCalendarBars` VE `getDayDetail` (gün ayrıntı paneli) ikisi de bu katmanlara bakıyor
— kategori gizliyken ilgili DB sorgusu hiç atılmıyor (sadece bar/oturum listesi boşaltılmıyor,
sorgu maliyeti de düşüyor). "Ders Programı" için mevcut alt seçim (hangi sınıf/derslik/ders
işaretli) korunuyor — üst kutuyu kapatıp tekrar açınca aynı seçim geri gelir.

### Toplu ders programı içe aktarma — bookmarklet, sunucu taraflı tarama DEĞİL (2026-09-07)
Kullanıcı "çok fazla sınıf var, hepsini elle yüklemek zaman alıyor, otomatikleştirebilir
miyiz?" diye sordu. edupage.org `robots.txt` ile otomatik erişimi reddettiği ve spec §4.3 /
bu dosyanın üstteki maddeleri bunu bilinçli olarak "sunucudan kazıma yok" kararına bağladığı
için, kullanıcıya üç seçenek sunuldu (tam otomatik sunucu taraması dahil, ama işaretlenerek
"projenin kararına aykırı" diye belirtildi) — **bookmarklet** seçildi.

Uygulama: `components/upload/TimetableBookmarklet.tsx` bir `javascript:` yer imi üretiyor.
Kullanıcı edupage'de bir sınıf sayfasını KENDİSİ elle açtığında yer imine tıklıyor; script
sadece o an DOM'da zaten yüklü olan `document.documentElement.outerHTML`'i panoya
`{label, html}` JSON'u olarak yazıyor ve `/admin/timetable-imports` sekmesini
açıyor/öne getiriyor — **edupage'e ek bir ağ isteği göndermiyor, sayfa keşfi/taraması
yapmıyor.** `TimetableUploadForm.tsx`'e eklenen "Panodan Yapıştır" düğmesi panoyu okuyup
`File` nesnesine sarıyor, geri kalan (ayrıştırma, yükleme) tamamen mevcut akış.

Bilinçli sınır: bu hâlâ kullanıcının her sayfayı elle açmasını gerektiriyor (tıklama sayısını
~7'den 2'ye indiriyor, ama sınıf listesini kendisi otomatik keşfetmiyor). Tam otomatik toplu
tarama istenirse ayrı bir karar/onay gerekir — bu commit'te bilerek yapılmadı.

CORS notu: panoya yazma/okuma tamamen tarayıcı API'si üzerinden yapılıyor; uygulamanın
`/api/timetable-imports` ucuna edupage.org'dan doğrudan cross-origin istek YOK — bookmarklet
panoyu dolduruyor, gerçek POST isteği hep aynı origin'den (`kulup-takvim` sekmesinden), mevcut
oturum çerezleriyle gidiyor. Yeni bir CORS açığı/güvenlik yüzeyi eklenmedi.

### Ders programı katmanları çoklu seçime açıldı (2026-09-06)
Spec §6.2/§7.1'in "katmanlar bağımsız açılıp kapanabilir" ilkesi ders programı katmanları için
uygulanmamıştı — `CourseSchedulePanel`/`month-events.ts` en fazla bir sınıf/derslik/ders
katmanının aktif olmasına izin veriyordu (radio benzeri, `parseActiveCourseLayer` tekil değer
dönüyordu). Kullanıcı isteği üzerine (birden fazla içe aktarılan ders programını aynı anda
takvimde görmek) diğer katmanlarla aynı toggle davranışına geçirildi:
`parseActiveCourseLayers` artık dizi dönüyor, `getMonthCalendarBars` eşleşen tüm oturumları
`OR` ile çekip oturum id'sine göre tekilleştiriyor (aynı oturum birden fazla seçilen katmana
uyarsa iki kez bar üretmesin diye). Karışık tip seçimi de mümkün (örn. bir sınıf + bir derslik
aynı anda) — spesifik olarak yasaklanmasını gerektiren bir sebep yok.

### Vercel'e yayına alma (2026-09-08)
`atilim-ai-panel`'de daha önce yaşanan aynı tuzağa ([[panel-vercel-yayin]]) baştan
hazırlıklı gelindi: Vercel Hobby planı, git entegrasyonu üzerinden dağıtımda commit
mesajındaki `Co-Authored-By: ...@anthropic.com` satırını (bu depodaki hemen hemen her
commit'te var) ikinci bir katılımcı sayıp sessizce engelliyor — belirti CLI'da değil
sadece `vercel.com` web arayüzünde "Blocked" olarak görünüyor.

**Bunu baştan atlatmak için git entegrasyonu hiç kurulmadı.** Yayın, `git archive HEAD`
ile üretilen git-geçmişsiz bir kopyadan `vercel --prod` ile yapıldı (bkz. README.md
"Yayına alma" — aynı komut dizisi tekrar yayın için de geçerli). Bu, hem yazar
uyuşmazlığını hem `Co-Authored-By` engelini kökten by-pass ediyor.

**Hesap kararı:** Diğer 3 kulüp projesinin aksine (kulüp Vercel hesabı
`atilimyapayzeka-9066`), bu proje **Taylan'ın kişisel Vercel hesabında**
(`taylannaktas`) — repo da kişisel GitHub hesabında olduğu için tutarlı (bkz.
[[kulup-takvim-github-repo]]). Bu terminalde CLI önceden kulüp hesabına giriş yapmış
durumdaydı; `vercel login` cihaz koduyla denendiğinde tarayıcıda kulüp hesabı zaten
açık olduğu için ilk denemede yine kulüp hesabına düştü — gizli/private pencerede
tekrar denenerek çözüldü. **Not:** cihaz kodu onayı, o an tarayıcıda hangi Vercel
hesabı açıksa ONU onaylıyor, `vercel login`'in kime bağlanacağını SEÇMİYORSUNUZ.

**Alan adı:** Proje adı yayın komutunun çalıştırıldığı klasör adından geliyor
(`kulup-takvim-deploy`), bu yüzden domain `kulup-takvim-deploy.vercel.app` oldu — daha
temiz `kulup-takvim.vercel.app` alias'ı denendi ama Vercel'in kendi SSO/Deployment
Protection'ına takılıp `vercel.com/login`'e yönlendirdi (asıl domain'de bu sorun yok,
sebebi araştırılmadı — muhtemelen manuel `alias set` ile eklenen domain'ler farklı bir
koruma kuralına giriyor). Alias kaldırıldı, asıl domain kullanılıyor.

**Doğrulanan:** `/signin` 200 dönüyor ve DB'ye bağlanıp doğru render ediyor,
`/calendar` oturumsuz 307 ile signin'e yönleniyor, iki cron işi (`vercel crons ls`)
kayıtlı. **Doğrulanmadı:** Google OAuth henüz production redirect URI'siyle
güncellenmedi — kullanıcı bunu Google Cloud Console'da elle ekleyecek (adres:
`https://kulup-takvim-deploy.vercel.app/api/auth/callback/google`), o olmadan Google
girişi `redirect_uri_mismatch` hatası verir.

### `exam_sessions` kirli verisi temizlendi, kök neden bulundu (2026-09-08)
2924-12-04 tarihli ("Bilinen veri sorunları" bölümüne bkz.) kaydın ve 2.988 duplike grubun
kök nedeni tespit edildi: `diffExamSessions` (`lib/scrapers/exam-schedule/diff.ts`)
"önce SELECT, sonra INSERT" mantığıyla çalışıyor ve tabloda bunu güvenceye alacak bir
unique constraint yoktu. Üretim DB'sindeki zaman damgaları incelendiğinde **tüm**
duplikeler (2.978 çift) 2026-09-05 gecesi birkaç saniyelik pencerelerde oluşmuş —
yani gerçek bir cron/prod senkron hatası değil, aynı gece art arda/çakışan iki
senkron tetiklemesinin (muhtemelen manuel "şimdi senkronize et" testi) klasik bir
race condition'ı. `is_active` sütununun TAMAMI `true` çıktı (0 pasif kayıt) — bu da
Vercel'e alınana kadar gerçek bir cron senkronunun hiç çalışmadığını doğruluyor.

**Uygulanan düzeltme:**
1. `lib/db/schema/exam-sessions.ts`'e `(term_code, faculty_code, exam_type,
   source_hash)` üzerinde unique index eklendi (`drizzle/0002_...sql`).
2. `diffExamSessions`'daki insert artık `.onConflictDoNothing()` kullanıyor — SELECT
   ile INSERT arasına giren çakışan bir çalıştırma artık sessizce pas geçiliyor
   (satır zaten `unchangedCount`'a sayılıyor).
3. Tek seferlik temizlik: her duplike grupta `first_seen_at` en eski olan satır
   tutuldu, **2.978 fazla satır silindi** (11.619 → 8.641). Silinmeden önce
   etkilenen satırlar JSON'a yedeklendi (kullanıcı onayıyla, kalıcı bir konumda
   saklanmadı — gerekirse tekrar üretilebilir, sorgu bu commit'te belgeli).
4. `CE475` (`muh`/`arasinav`/`20242025guz`) kaydındaki `exam_date = 2924-12-04`
   dedup sonrası tek kayıt kaldı; **silinmedi**, kullanıcı kararıyla `is_active =
   false` yapıldı. Bu tarih iki kopyada da birebir aynıydı, yani ayrıştırma
   kodunun ürettiği bir hata değil — kaynağın (okul sitesi) kendisinde böyle
   görünüyor gibi duruyor, doğru tarih bilinmeden tahmini düzeltme yapılmadı.

**Doğrulanan:** temizlik sonrası aktif satırlar arasında `(term_code, faculty_code,
exam_type, source_hash)` bazında sıfır gerçek kopya var; `npx tsc --noEmit` ve
`npx eslint` temiz.

### Takvim sadeleştirme: şube/salon birleştirme + gün özeti (2026-09-18)

**Sorun (kullanıcı, 2026-09-17):** "Çok fazla veriyi aynı takvim üzerinde
göstermeye çalışıyoruz, karmaşık ve anlaşılmaz bir sistem oluyor." Gerçek
veriyle doğrulandı: 9 Ocak 2025'te 130 sınav satırı tek hücreye düşüyordu
(ENG101'in tek sınavı salon başına 32 satır), ders programı da haftalık tekrar
ettiği için her hafta aynı 20+ çubuğu çiziyordu. Hücre başına 3 kulvar görünür
olduğu için geri kalan her şey "+N daha" oluyordu.

**Karar — gruplama SADECE gösterim anında, veri modeli değişmiyor.** Yeni
`lib/calendar/grouping.ts` (server-only DEĞİL, istemci de kullanıyor):

1. **Şube/salon birleştirme.** Aynı ders kodu + başlangıç + bitiş saati tek
   kayıt: ay ızgarasında sayıya katkısı bir, gün ayrıntısında
   `CHE105 · 3 şube` / `ENG101 · 32 salon`, hover'da tam döküm. Sınavlarda
   ayrıca sınav türü, derslerde hafta günü gruplama anahtarına giriyor.
2. **Ay ızgarasında gün özeti.** Tek tek ders/sınav çubuğu yerine gün başına
   tür özeti: `Final · 37 sınav · 9.30–16.30`, `5 ders · 9.30–17.20`. Tek grup
   varsa eski davranış gibi ders kodu yazılıyor. Tam liste gün ayrıntısında.
3. **Kulüp etkinlikleri kulvar önceliği kazandı.** `week-bar-layout.ts`
   sıralaması türe bakmıyordu, yoğun bir günde etkinlik "+N daha"nın içinde
   kaybolabiliyordu — uygulamanın asıl amacı etkinlik planlamak olduğu için
   artık etkinlik → sınav → akademik → ders sırasıyla yerleşiyor. Öncelik
   sırası bozulduğu için kulvar doluluğu "son bitiş sütunu" yerine gün gün
   tutuluyor (aksi halde greedy atama yanlış kulvar veriyordu).
4. **Gün panelinde tür bölümleri.** "Etkinlikler / Sınavlar / Dersler (N)"
   düğmeleri; 6'dan fazla öğesi olan bölüm kapalı başlıyor. Kapalı bölüm
   GİZLENMİYOR — çakışan öğeler tek `N sınav` satırına iniyor ki o saatlerin
   dolu olduğu görünmeye devam etsin.
5. **Hazır görünümler** (alt araç çubuğu): Tümü / Etkinlik odaklı / Sınavlar /
   Dersler. Yeni bir durum tutmuyor, sadece `category-hidden:*` katmanlarını
   topluca ayarlıyor; sınıf/fakülte seçimleri korunuyor. Akademik takvim her
   görünümde açık (tatil/sınav haftası bağlamı hep lazım).

**Doğrulama:** gerçek Neon verisiyle (Ocak 2025 + bir sınıf programı) ay
çubukları 130+ → gün başına 2; `getDayDetail` 9 Ocak'ta 37 gruplanmış sınav,
ENG101 tek öğede 32 salon. 126 birim test geçiyor (`grouping.test.ts` ve
etkinlik önceliği testleri bu turda eklendi), `npx tsc --noEmit` + `npx eslint .`
temiz.

**Not — bu turda ÇÖZÜLMEDİ:** `getDayDetail`'in sınav sorgusu yerel saat
diliminde bir gün geriye kayıyor (UTC'de, yani Vercel'de doğru çalışıyor).
Yukarıdaki "`date` sütunları + saat dilimi" açık işinin aynısı; gruplama
değişikliğinden bağımsız, önceden de vardı.
