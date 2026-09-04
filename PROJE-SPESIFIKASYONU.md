# Kulüp Takvim ve Etkinlik Planlama Paneli — Proje Spesifikasyonu

**Kurum:** Atılım Üniversitesi
**Kullanan:** IEEE Computer Society öğrenci kulübü yönetimi (3 kişi)
**Dağıtım:** Merkezi web uygulaması, erişimi izin listesiyle sınırlı
**Lisans hedefi:** GitHub'da açık kaynak — bu yüzden hiçbir gizli değer koda gömülmeyecek

---

## 1. Amaç

Kulüp etkinliklerinin ne zaman yapılacağına karar verirken üç soruya tek ekranda cevap vermek:

1. O gün/saat okulda sınav, tatil veya kritik bir akademik tarih var mı?
2. Kulüp üyeleri ve hedeflediğimiz kitle o saatte derste mi?
3. Zaten planlanmış başka bir etkinlikle çakışıyor mu?

Ürünün merkezinde **büyük bir aylık takvim** var. Sol taraftaki kaynak panellerinden yapılan her seçim, takvim üzerinde renkli bir katman olarak belirir.

---

## 2. Kullanıcılar ve erişim

### 2.1 Erişim modeli

Uygulama internete açık bir adreste barınacak ama **linki bilen herkes giremeyecek.** Yalnızca önceden tanımlanmış e-posta adresleri erişebilecek.

**Gereksinim:** Etkinlik planları ve taslaklar hassas bilgi sayılıyor; yetkisiz erişim kabul edilemez.

### 2.2 Roller

| Rol | Yetki |
|---|---|
| `admin` | Her şey + izin listesini görüntüleme, veri kaynağı ayarları, manuel senkron tetikleme |
| `editor` | Etkinlik/not oluşturma, düzenleme, silme; filtre ve görünüm ayarları |
| `viewer` | Sadece okuma (ileride komite üyelerine açmak istenirse) |

Başlangıçta 3 yönetim üyesi de `admin` olacak. Rol bilgisi veritabanında tutulacak, e-posta izin listesi ortam değişkeninde.

### 2.3 Açık kaynak uyumu

Depo herkese açık olacağı için:

- İzin listesi, veritabanı bağlantısı, OAuth anahtarları, cron gizli anahtarı **yalnızca ortam değişkeni** olacak
- Depoda `.env.example` bulunacak, gerçek `.env` `.gitignore`'da olacak
- Başka bir komite depoyu klonlayıp kendi ortam değişkenleriyle kendi örneğini çalıştırabilmeli — kurum/fakülte listeleri ve kaynak URL'leri kod içinde sabit değil, `config/` altında düzenlenebilir dosyalarda olmalı

---

## 3. Teknoloji önerisi

Bunlar öneri; Claude Code gerekçeli olarak değiştirebilir ama sapma varsa nedenini planında belirtmeli.

| Katman | Seçim | Gerekçe |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Sunucu tarafı çekme, cron, API rotaları ve arayüz tek projede |
| Barındırma | Vercel (ücretsiz katman yeterli) | Cron Jobs desteği hazır |
| Veritabanı | Postgres (Neon / Supabase ücretsiz katman) | İlişkisel veri, eşzamanlı 3 kullanıcı |
| ORM | Drizzle veya Prisma | Şema göçleri |
| Kimlik doğrulama | Auth.js (NextAuth) + Google sağlayıcı | Üniversite Google hesaplarıyla giriş |
| Arayüz | React + Tailwind | — |
| Takvim | Kendi ızgara bileşeni (hazır kütüphane değil) | Aşağıdaki renk katmanı davranışı hazır kütüphanelerde zorlanıyor; ay ızgarası zaten basit |
| Tarih işleri | `date-fns` + `date-fns-tz`, saat dilimi `Europe/Istanbul` sabit | — |
| HTML ayrıştırma | `cheerio` | Sunucu tarafı kazıma |

**Saat dilimi uyarısı:** Tüm tarihler veritabanında UTC olarak saklanacak ama takvim ızgarası daima `Europe/Istanbul` üzerinden hesaplanacak. Vercel sunucuları UTC çalışır; "gün" sınırları bu yüzden kaymamalı. Testlerde bu özellikle doğrulanmalı.

---

## 4. Veri kaynakları

Bu bölüm kritik. Üç kaynağın üçü de farklı davranıyor ve **hepsi otomatik çekilemiyor.**

### 4.1 Akademik takvim — TAM OTOMATİK ✅

- **Kaynak:** `https://www.atilim.edu.tr/tr/oim/page/{id}/...` (yıl bazlı sayfalar)
- **Keşif:** `https://www.atilim.edu.tr/tr/oim` sayfasındaki "Akademik Takvim" menüsünden yıl sayfalarının bağlantıları toplanır
- **Yapı:** Düz HTML `<table>`. Üç sekme: Güz / Bahar / Yaz. Sütunlar: `SNO | BAŞLANGIÇ TARİHİ | BİTİŞ TARİHİ | AÇIKLAMA`
- **Tarih formatı:** `14 Eylül 2026 Pazartesi` — Türkçe ay adları, gün adı sonda. Bitiş tarihi boş olabilir (tek günlük olay demektir)
- **Not:** Tıp Fakültesi'nin ayrı takvimi var, kapsam dışı
- **Doğrulandı:** Bu sayfa engelsiz çekiliyor, tablo yapısı temiz

**Sınıflandırma:** Her satır açıklamasına göre etiketlenmeli. Anahtar kelime tabanlı bir sınıflandırıcı yaz, ama sonuç `config/calendar-classification.ts` içinden düzenlenebilir olsun:

- `SINAV` — "sınav", "APEX", "yeterlik", "mazeret sınav"
- `TATIL` — "bayram", "tatil", "yılbaşı", resmi gün adları
- `DERS_DONEMI` — "derslerin başlaması", "sona ermesi"
- `KAYIT` — "ders kayıt", "ekle-bırak", "danışman onayı"
- `IDARI` — kalan her şey (başvuru son günleri vb.)

Sınıflandırma kesin olmayacak; arayüzde bir satırın türü elle değiştirilebilmeli ve bu değişiklik sonraki senkronda korunmalı (override tablosu).

### 4.2 Sınav programı — OTOMATİK, KIRILGAN ⚠️

- **Keşif sayfası:** `https://www.atilim.edu.tr/tr/dersprogrami` — "Sınav Programları" sekmesinde dönem/fakülte bazlı tüm bağlantılar burada. Her dönem yeni satırlar eklenir, eskiler kalır
- **Bağlantı deseni:** `https://dersprogramiyukle.atilim.edu.tr/{donem}{tur}/{fakulte}`
  - Örnek: `20252026guzarasinav/muh`, `20252026baharfinal/servis`, `20252026guzmazeret/servis`
  - Fakülte kısaltmaları: `servis`, `muh`, `isletme`, `cav`, `fef`, `saglik`, `shmyo`, `gsmf`, `gsod`, `etp`, `hukuk`, `pilotaj`
  - Tür kısaltmaları: `arasinav`, `final`, `mazeret`
- **Yapı:** Excel'in "Web Sayfası Olarak Kaydet" çıktısı. **Kök URL bir `<frameset>`** — içerik `sheet001.htm` gibi alt dosyalarda. `tabstrip` içeren frame'ler sekme çubuğudur, atlanmalı
- **Doğrulandı:** Kök URL çekilebiliyor ve gerçekten frameset döndürüyor

**Uygulama notu:** Sütun sırası dönemden döneme ve fakülteden fakülteye değişebiliyor. Bu yüzden sabit indeks (`cols[0]`, `cols[1]`) kullanma. Bunun yerine:

1. Başlık satırını bulmaya çalış (içinde "ders", "tarih", "saat", "derslik", "sınıf" geçen satır)
2. Başlıktan sütun eşlemesi çıkar
3. Eşleme çıkarılamazsa satırları **ham** olarak sakla ve arayüzde "bu kaynağın sütun eşlemesi yapılamadı, elle eşle" ekranı göster (kullanıcı bir kez sütun eşlemesini seçer, `source_column_mapping` tablosuna kaydedilir, sonraki senkronlarda kullanılır)

Bu, kaynağın kırılganlığını sessiz bir hataya değil, görünür ve çözülebilir bir göreve dönüştürür.

### 4.3 Ders programı — YARI OTOMATİK, ELLE İÇE AKTARMA 🔶

- **Kaynak:** `https://atilim.edupage.org/timetable/view.php?num={n}&class=*{id}` ve fakülte alt alan adları (`atilimengr`, `atilimmgmt`, `atilimartsci`, `atilimhlth`, `atilimcav`, `atilimlaw`, `atilimgstm`)
- **Sorun:** edupage.org `robots.txt` ile otomatik erişimi **açıkça reddediyor.** Doğrulandı.

**Bu kaynağı sunucudan kazıma.** Yerine "içe aktarma" akışı kur:

1. Kullanıcı tarayıcıda edupage sayfasını açar
2. **Ctrl+S → "Web Sayfası, Tamamı"** ile kaydeder (veya sayfanın HTML'ini kopyalar)
3. Uygulamadaki "Ders programı içe aktar" ekranına dosyayı sürükler
4. Sunucu tarafındaki ayrıştırıcı dosyayı işler ve veritabanına yazar
5. Arayüz "en son ne zaman güncellendi" bilgisini gösterir; 30 günden eskiyse uyarı verir

**Ayrıştırıcı ipucu:** edupage tüm zaman çizelgesi verisini sayfa içinde bir JSON bloğu olarak taşır (`ttview`, `dbi`, `datarows` gibi anahtarlar). Önce bu JSON'u yakalamayı dene — HTML tablosunu DOM'dan okumaktan çok daha sağlam ve **tek dosyada sınıflar, derslikler, dersler, öğretmenler ve tüm oturumlar birden gelir.** JSON bulunamazsa render edilmiş tabloya düş.

Bu tasarım dönem başına **bir kez** manuel işlem gerektirir, gerisi otomatiktir.

### 4.4 Senkronizasyon zamanlaması

| Kaynak | Sıklık | Yöntem |
|---|---|---|
| Akademik takvim | Günde 1 (03:00 TR) | Vercel Cron |
| Sınav programı | Günde 1 (03:15 TR) | Vercel Cron |
| Ders programı | Manuel | Kullanıcı yüklemesi |

Cron uç noktası `CRON_SECRET` ortam değişkeniyle korunacak; `Authorization` başlığı doğrulanmadan çalışmayacak. Ayrıca arayüzden "şimdi senkronize et" butonu olacak (yalnızca `admin`).

### 4.5 Değişiklik tespiti — ÖNEMLİ ÖZELLİK

Okul sınav tarihlerini **yayınladıktan sonra değiştirebiliyor.** Bu, planlanmış bir etkinliği sessizce çakışmaya sokabilir.

Her senkronda:

1. Yeni çekilen veri, öncekiyle karşılaştırılır (kayıt bazlı hash)
2. Değişiklikler `sync_changes` tablosuna yazılır: eklendi / silindi / tarihi değişti / saati değişti
3. Değişen bir kayıt **planlanmış bir kulüp etkinliğiyle artık çakışıyorsa**, o etkinlik "çakışma uyarısı" bayrağı alır
4. Arayüzde üstte bir bildirim şeridi: "Son senkronda 3 sınav tarihi değişti, 1 etkinliğin çakışması var"

Bu özellik ürünün en değerli kısımlarından biri — sadece veri göstermekle kalmıyor, insanın gözünden kaçacak şeyi yakalıyor.

---

## 5. Veri modeli

```
users
  id, email, name, role (admin|editor|viewer), created_at, last_login_at

academic_calendar_entries
  id, source_year (örn "2026-2027"), term (guz|bahar|yaz)
  start_date, end_date, description
  category (SINAV|TATIL|DERS_DONEMI|KAYIT|IDARI)
  category_override        -- kullanıcı elle değiştirdiyse
  source_hash, first_seen_at, last_seen_at, is_active

exam_sessions
  id, faculty_code, exam_type (arasinav|final|mazeret)
  term_code (örn "20262027guz")
  course_code, course_name
  exam_date, start_time, end_time, room, section
  raw_row (jsonb)          -- ayrıştırma başarısızsa ham satır
  source_url, source_hash, first_seen_at, last_seen_at, is_active

course_sessions              -- ders programı (edupage içe aktarma)
  id, import_id
  course_code, course_name, section
  faculty_code, program_name, class_year
  weekday (1-7), start_time, end_time
  room, instructor

timetable_imports
  id, uploaded_by, uploaded_at, source_label, term_code
  parsed_session_count, notes

rooms                        -- derslikler (edupage içe aktarmadan türetilir)
  code, building, capacity

club_events
  id, title, description
  start_at, end_at, is_all_day
  status (fikir|planlaniyor|onaylandi|yapildi|iptal)
  location, expected_attendance
  color_override
  created_by, created_at, updated_by, updated_at
  conflict_flags (jsonb)     -- {exam: [...], holiday: [...], event: [...]}

day_notes                    -- takvimde bir güne iliştirilmiş serbest not
  id, date, body, created_by, created_at, updated_at

members                      -- üyeler ve hedef kitle
  id, display_name, category (uye|hedef_kitle)
  faculty_code, program_name, class_year
  course_codes (text[])      -- aldığı dersler
  created_at

sync_runs
  id, source (akademik_takvim|sinav_programi), started_at, finished_at
  status (ok|kismi|hata), fetched_count, changed_count, error_detail

sync_changes
  id, sync_run_id, entity_type, entity_id
  change_type (eklendi|silindi|guncellendi)
  before (jsonb), after (jsonb)

source_column_mapping        -- 4.2'deki elle eşleme
  id, source_url_pattern, mapping (jsonb), created_by, created_at

audit_log
  id, user_id, action, entity_type, entity_id, diff (jsonb), created_at
```

---

## 6. Arayüz spesifikasyonu

### 6.1 Genel yerleşim

```
┌─────────────────────────────────────────────────────────────────────┐
│  Üst şerit: logo · dönem seçici · arama · senkron durumu · kullanıcı │
├──────────────────┬──────────────────────────────────────────────────┤
│                  │                                                  │
│  SOL PANELLER    │              AYLIK TAKVİM                        │
│  (genişlik ~320) │              (kalan tüm alan)                    │
│                  │                                                  │
│ ┌──────────────┐ │   Pzt   Sal   Çar   Per   Cum   Cmt   Paz        │
│ │ Ders Prog.   │ │  ┌────┬────┬────┬────┬────┬────┬────┐            │
│ │ [sekmeler]   │ │  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │            │
│ │  içerik      │ │  │▓▓▓ │    │ ▪▪ │▓▓▓ │    │    │    │            │
│ ├──────────────┤ │  ├────┼────┼────┼────┼────┼────┼────┤            │
│ │ Sınav Prog.  │ │  │ 8  │ 9  │ 10 │ 11 │ 12 │ 13 │ 14 │            │
│ │ [sekmeler]   │ │  │    │ ▪  │████████████████│    │    │           │
│ │  içerik      │ │  └────┴────┴────┴────┴────┴────┴────┘            │
│ ├──────────────┤ │                                                  │
│ │ Akademik Tk. │ │                                                  │
│ │  (kaydırma)  │ │                                                  │
│ └──────────────┘ │                                                  │
│                  ├──────────────────────────────────────────────────┤
│                  │  ALT ARAÇ ÇUBUĞU                                 │
│                  │  ◀ Eylül 2026 ▶ · Bugün · [Ay|Hafta|Gün|Dönem]  │
│                  │  + Etkinlik  + Not  · Katmanlar ▾ · Dışa aktar  │
└──────────────────┴──────────────────────────────────────────────────┘
```

- Sol paneller **tek tek katlanabilir** (accordion), böylece biri tam yüksekliği kullanabilir
- Sol panelin tamamı gizlenebilir (takvim tam ekran olur)
- 1024px altında sol paneller alta iner / çekmeceye dönüşür

### 6.2 Sol panel 1 — Ders Programı

Üst kısımda sekmeler (edupage'in kendi arayüzündeki gibi):

| Sekme | İçerik |
|---|---|
| **Sınıflar** | Fakülte → bölüm → sınıf ağacı. Bir düğüm seçilince o sınıfın haftalık programı listelenir |
| **Derslikler** | Derslik listesi + arama. Seçilince o dersliğin doluluk programı |
| **Dersler** | Ders kodu/adı ile aranabilir liste. Seçilince o dersin tüm oturumları |
| **Toplu Çizelge** | Seçili filtredeki her şeyin haftalık ızgara görünümü (gün × saat matrisi) |

Her sekmede üstte fakülte filtresi. Seçilen her öğe **takvimde bir katman** olarak belirir (bkz. 6.5).

Panel altında: "Son güncelleme: 12 Eylül 2026 · Yeniden içe aktar" bağlantısı.

### 6.3 Sol panel 2 — Sınav Programı

Üst kısımda iki satır filtre butonu:

```
Fakülte:  [Servis] [Mühendislik] [İşletme] [FEF] [Sağlık] [GSTMF] [SHMYO] [Sivil Hav.] [Hukuk]
Tür:      [Vize 1] [Vize 2] [Final] [Mazeret]
```

- Çoklu seçim (birden çok fakülte aynı anda seçilebilir)
- Altında seçime uyan sınav listesi: `Tarih · Saat · Ders Kodu · Derslik`
- Tarihe göre gruplanmış, kaydırılabilir
- Bir sınava tıklanınca takvim o güne gider ve sınav vurgulanır

**Not — "Vize 1 / Vize 2" konusunda dikkat:** Okul kaynağında sadece `arasinav` (tek ara sınav) var; birinci/ikinci vize ayrımı URL'lerde görünmüyor. Eğer okul dönem içinde iki ayrı ara sınav yayınlıyorsa bunlar farklı `donem` kodlarıyla ayrı sayfalarda olur. Uygulama, keşfedilen tüm sınav sayfalarını listeleyip **etiketlemeyi kullanıcıya bırakmalı** (`config/exam-sources.ts` içinde ad verilebilir). Sabit "Vize 1 / Vize 2" varsayma; keşfedilen kaynakları göster.

### 6.4 Sol panel 3 — Akademik Takvim

- Doğrudan kaydırılabilir kronolojik liste (sekme yok)
- Her satır: `tarih aralığı · açıklama · tür rozeti`
- Bugüne en yakın kayıt otomatik olarak görünüme kaydırılır, sol tarafında bir işaret
- Üstte tür filtresi çipleri: `Sınav` `Tatil` `Ders dönemi` `Kayıt` `İdari`
- Bir satıra tıklanınca takvim o aya gider ve ilgili günler vurgulanır
- Bir satırın türü sağ tıkla / menüden değiştirilebilir (bkz. 4.1 override)

### 6.5 Ana takvim

**Aylık ızgara (varsayılan görünüm)**

Her gün hücresi:

- Sol üstte gün numarası; bugün belirgin
- Hücre arka planı, o günün **baskın durumuna** göre hafif tonlanır (sınav dönemi, tatil)
- Altında olay çubukları. Çok günlü olaylar hücreler boyunca **kesintisiz şerit** olarak uzanır
- 3'ten fazla olay varsa `+2 daha` göstergesi
- Hafta sonu hücreleri hafifçe farklı zeminde
- İçinde bulunulan aya ait olmayan gün hücreleri soluk

**Renk sistemi** (semantik, keyfi değil):

| Olay türü | Renk | Kullanım |
|---|---|---|
| Final sınavı | Koyu kırmızı | Hücre zemini + çubuk |
| Ara sınav (vize) | Turuncu-kırmızı | Çubuk |
| Mazeret sınavı | Açık kırmızı, kesikli çerçeve | Çubuk |
| Resmi tatil / bayram | Kahverengimsi gri, hücre zemini | Zemin |
| Ders dönemi sınırı | Mavi, ince üst çizgi | İşaret |
| Kayıt / ekle-bırak | Mavi çubuk | Çubuk |
| Ders oturumu (seçili katman) | Mor, düşük opaklık | Çubuk |
| Kulüp etkinliği — onaylandı | Yeşil, dolu | Çubuk |
| Kulüp etkinliği — planlanıyor | Yeşil, çerçeveli | Çubuk |
| Kulüp etkinliği — fikir | Yeşil, kesikli | Çubuk |
| Gün notu | Sarı köşe üçgeni | İşaret |
| Çakışma uyarısı | Kırmızı ünlem rozeti | Çubuk üzerinde |

**Renk tek başına anlam taşımamalı.** Her çubukta metin etiketi veya ikon bulunmalı; renk körlüğü ve yazdırma için gerekli. Ayrıca "yüksek kontrast" tercihi ayarlarda bulunsun.

**Gün ayrıntı görünümü**

Bir güne tıklanınca sağdan bir panel açılır (takvim daralır, kapanmaz):

- Üstte tarih ve o günün özeti ("Final dönemi · 4 sınav · 1 etkinlik")
- **Saat bazlı dikey zaman çizelgesi**, 08:00–22:00 aralığı, 30 dk çizgileri
- Sınavlar, ders oturumları, kulüp etkinlikleri bu çizelgede kutu olarak konumlanır
- Aynı saatte birden fazla varsa yan yana dizilir
- Boş aralıklar görsel olarak belli olur
- Altta: bu güne not ekle, bu güne etkinlik ekle
- "Bu gün neden kırmızı?" — o günü etkileyen tüm akademik takvim kayıtları listelenir

**Diğer görünümler**

| Görünüm | İçerik |
|---|---|
| **Ay** | Varsayılan, yukarıda tarif edilen |
| **Hafta** | 7 gün × saat ızgarası; ders oturumları en net burada görünür |
| **Gün** | Tek günün saat çizelgesi, tam genişlik |
| **Dönem** | Tüm dönemin ısı haritası — her gün bir kare, yoğunluğa göre renk. "Hangi haftalar boş" sorusuna tek bakışta cevap. Bu görünüm etkinlik planlamada en çok işe yarayan görünüm olacak |

### 6.6 Alt araç çubuğu

```
◀  Eylül 2026  ▶   [Bugün]   |   [Ay] [Hafta] [Gün] [Dönem]
[+ Etkinlik]  [+ Not]  |  Katmanlar ▾  |  Uygunluk analizi  |  Dışa aktar ▾
```

- **Katmanlar** açılır menüsü: aktif katmanları listeler, tek tek kapatılabilir, "hepsini temizle"
- **Dışa aktar:** `.ics` dosyası (Google Takvim'e aktarma), yazdırılabilir PDF, PNG görüntü

---

## 7. Özellikler

### 7.1 Çekirdek

1. **Katman sistemi** — sol panellerden yapılan her seçim takvime bir katman ekler; katmanlar bağımsız açılıp kapanabilir, URL'de saklanır (paylaşılabilir bağlantı)
2. **Etkinlik oluşturma** — başlık, tarih/saat, konum, durum, açıklama, beklenen katılım
3. **Çakışma denetimi** — etkinlik kaydedilirken sınav/tatil/başka etkinlikle çakışma varsa **engellemeden uyarı** göster ("23 Aralık'ta final sınavları başlıyor — yine de kaydet?")
4. **Gün notları** — herhangi bir güne serbest metin not
5. **Otomatik senkron + değişiklik bildirimi** (bkz. 4.4, 4.5)
6. **Arama** — `Cmd/Ctrl+K`: ders kodu, sınav, etkinlik, akademik takvim kaydı; sonuca tıklayınca takvim oraya gider

### 7.2 Uygunluk analizi

Ayrı bir ekran veya modal:

- Girdi: tarih aralığı, süre, gün içi saat aralığı, hangi kitle (üyeler / hedef kitle / ikisi)
- Çıktı: en uygun zaman aralıkları, müsait kişi oranına göre sıralı
- **Isı haritası görünümü**: gün × saat ızgarası, her hücrede kaç kişinin boş olduğu renk yoğunluğuyla
- Sınav ve tatil günleri otomatik elenir
- Sonuçtan doğrudan "bu saate etkinlik oluştur" yapılabilir

Üye ders bilgisi `members` tablosundan gelir; bir Google Form'dan CSV içe aktarma desteği olsun.

### 7.3 Boş derslik bulucu

Ders programı verisi zaten derslik bilgisi içeriyor. Bunu kullanarak:

- "12 Kasım Perşembe 15:00–17:00 arası hangi derslikler boş?"
- Kapasiteye göre filtreleme
- Sonuçtan etkinlik konumu olarak seçilebilir

Bu, etkinlik planlamanın en can sıkıcı kısmını çözer ve veri zaten elimizde.

### 7.4 İşbirliği

- **Denetim kaydı:** kim ne zaman ne değiştirdi — 3 kişi aynı takvim üzerinde çalışacağı için gerekli
- **Eşzamanlı düzenleme koruması:** aynı etkinliği iki kişi düzenlerse son yazan kazanmasın; kaydetme sırasında `updated_at` kontrolü, çakışma varsa "bu kayıt siz düzenlerken değişti" uyarısı
- **Etkinlik yorumları** (opsiyonel, faz 3): etkinlik altında kısa tartışma

### 7.5 Bildirim (faz 3)

- Sınav programı değiştiğinde ve planlanmış etkinliği etkilediğinde
- Etkinlikten 3 gün önce hatırlatma
- Kanal: e-posta veya Discord/Slack webhook (ortam değişkeniyle yapılandırılabilir, zorunlu değil)

### 7.6 Erişilebilirlik ve kalite tabanı

- Klavyeyle tam gezinme; takvim ızgarasında ok tuşlarıyla gün gün hareket
- Görünür odak halkaları
- Renk + metin/ikon birlikte (renk tek başına anlam taşımaz)
- `prefers-reduced-motion` desteği
- Mobil: takvim dikey listeye dönüşür, sol paneller alt çekmece
- Yazdırma stili: aylık görünüm siyah-beyaz yazdırıldığında okunabilir olmalı

---

## 8. Güvenlik gereksinimleri

Bunlar **kabul kriteri**, öneri değil.

1. **Kimlik doğrulama tüm uygulamayı kapsar.** Middleware; hem sayfalar hem `/api/*` rotaları korunur. Oturumsuz istek hiçbir veri döndürmez
2. **İzin listesi ortam değişkeninde:** `ALLOWED_EMAILS="a@x.com,b@x.com,c@x.com"`. Giriş yapan e-posta listede yoksa oturum oluşturulmaz ve kullanıcı kaydı yaratılmaz
3. **Cron uç noktası ayrı korunur:** `CRON_SECRET` başlığı olmadan çalışmaz; oturum kontrolünden bağımsızdır
4. **Hiçbir gizli değer depoda olmaz.** `.env.example` yalnızca anahtar adlarını içerir
5. **Veritabanı bağlantısı yalnızca sunucu tarafında.** İstemciye asla bağlantı dizesi veya servis anahtarı sızmaz
6. **Dış kaynaklardan gelen HTML güvenilmez veri olarak işlenir.** Çekilen içerik hiçbir zaman `dangerouslySetInnerHTML` ile render edilmez; metin olarak temizlenir
7. **Yükleme boyutu ve tür kontrolü:** ders programı içe aktarmada dosya boyutu sınırı ve içerik türü doğrulaması
8. **Oran sınırlaması:** manuel senkron tetikleme uç noktasında (kaynak siteye yük bindirmemek için)

**Vercel notu:** Vercel'in kendi "Deployment Protection" özelliği ek bir katman sağlar ama ücretli planlara bağlı olabilir. Uygulama içi kimlik doğrulama tek başına yeterli olacak şekilde tasarlanmalı; Vercel koruması varsa bonus.

**Dış siteye erişim etiği:** Kazıyıcı `User-Agent` başlığında projenin adını ve bir iletişim adresini belirtmeli, istekler arasında gecikme olmalı, ve günde birden fazla çalışmamalı. `robots.txt`'i reddeden hiçbir alan adına otomatik istek atılmamalı (bkz. 4.3 — edupage).

---

## 9. Ortam değişkenleri

```
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAILS=            # virgülle ayrılmış
ADMIN_EMAILS=              # virgülle ayrılmış, ALLOWED_EMAILS'in alt kümesi
CRON_SECRET=
SCRAPER_USER_AGENT=        # örn "IEEE-CS-Atilim-Planner/1.0 (iletisim@...)"
NOTIFY_WEBHOOK_URL=        # opsiyonel
```

---

## 10. Yol haritası

**Faz 1 — İskelet ve veri (öncelik)**
Proje kurulumu, kimlik doğrulama + izin listesi, veritabanı şeması, akademik takvim kazıyıcısı, temel aylık takvim ızgarası, akademik takvim paneli.
*Bitince:* Giriş yapıp sınav ve tatil dönemlerini takvimde görebiliyoruz.

**Faz 2 — Sınav programı ve etkileşim**
Sınav programı kazıyıcısı (frameset + sütun eşleme ekranı), sınav paneli ve filtre butonları, katman sistemi, gün ayrıntı paneli (saat çizelgesi), renk sistemi.
*Bitince:* Sol panellerden seçim yapıp takvimi renklendirebiliyoruz, güne tıklayıp saat bazında görebiliyoruz.

**Faz 3 — Etkinlikler ve işbirliği**
Etkinlik CRUD, çakışma denetimi, gün notları, denetim kaydı, eşzamanlı düzenleme koruması, cron + değişiklik tespiti.
*Bitince:* Üç kişi ortak plan yapabiliyor, okul veriyi değiştirince haberimiz oluyor.

**Faz 4 — Ders programı ve analiz**
edupage içe aktarma akışı ve ayrıştırıcı, ders programı paneli (4 sekme), üye yönetimi, uygunluk analizi + ısı haritası, boş derslik bulucu.
*Bitince:* Ürün tam işlevsel.

**Faz 5 — Cila**
Dönem ısı haritası görünümü, `.ics` dışa aktarma, arama, bildirimler, yazdırma stili, mobil iyileştirme, erişilebilirlik denetimi.

---

## 11. Kabul kriterleri

- [ ] İzin listesinde olmayan bir e-postayla giriş denendiğinde erişim reddediliyor ve kullanıcı kaydı oluşmuyor
- [ ] Oturum açmadan `/api/events` gibi bir uca yapılan istek veri döndürmüyor
- [ ] Akademik takvim senkronu 2026-2027 sayfasından üç dönemi de (güz/bahar/yaz) doğru ayrıştırıyor
- [ ] Türkçe tarihler (`14 Eylül 2026 Pazartesi`) doğru çözülüyor; bitiş tarihi boş olan satırlar tek günlük olarak işleniyor
- [ ] Sınav programı frameset'i çözülüyor; sütun eşlemesi yapılamayan kaynak için elle eşleme ekranı çıkıyor
- [ ] Gün hücresine tıklandığında saat bazlı çizelge açılıyor ve o günün tüm olayları doğru saatte konumlanıyor
- [ ] Çok günlü bir akademik takvim kaydı, ay ızgarasında kesintisiz şerit olarak görünüyor
- [ ] Saat dilimi: UTC sunucuda çalışırken bile gün sınırları `Europe/Istanbul`'a göre doğru
- [ ] Sınav tarihi değiştiğinde `sync_changes` kaydı oluşuyor ve etkilenen etkinlik uyarı alıyor
- [ ] Renk körlüğü simülasyonunda takvim hâlâ okunabilir (renk + etiket)
- [ ] `.env` depoda yok, `.env.example` var

---

## 12. Bilinen riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Sınav programı Excel çıktısının sütun düzeni değişir | Ayrıştırma bozulur | Elle sütun eşleme ekranı + ham satır saklama |
| Okul sayfa yapısını değiştirir | Kazıyıcı kırılır | Senkron hatası sessiz kalmaz; arayüzde "son senkron başarısız" şeridi |
| edupage içe aktarma dönem başında unutulur | Ders verisi eskir | 30 gün kuralı + uyarı şeridi |
| Vercel ücretsiz katman cron sınırı | Senkron çalışmaz | Günde 1-2 çalıştırma yeterli, sınır içinde |
| Üç kişi aynı anda düzenler | Veri kaybı | `updated_at` çakışma kontrolü |

---

## 13. Claude Code'a not

Bu belge **ne** yapılacağını tarif ediyor, **nasıl** yapılacağının tamamını değil. Planını çıkarırken:

- Önce Faz 1'i uçtan uca çalışır hâle getir; her fazın sonunda çalışan bir ürün olsun
- Kazıyıcıları **gerçek HTML'e karşı** test et; sabit indeks yerine yapı tespiti kullan
- Her kazıyıcı için, çekilen ham HTML'in bir örneğini `fixtures/` altına kaydet ve birim testlerini bunun üzerinden yaz — kaynak site erişilemez olsa da testler çalışsın
- 4.3'te tarif edilen edupage kısıtına uy; o alan adına sunucudan otomatik istek atma
- Belirsiz kaldığın yerlerde varsayım uydurmak yerine `DECISIONS.md` dosyasına soru olarak yaz
