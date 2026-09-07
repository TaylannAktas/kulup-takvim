# EKIP.md — Kulüp Takvim ve Etkinlik Planlama Paneli

Bu dosya, projeye yeni katılan bir geliştiricinin kendi kullandığı yapay zekaya
(Claude Code, Cursor, vb.) okutup projeyi geliştirmeye hazır hâle gelmesi için
yazıldı. Amaç ne yapılacağını değil, **projenin ne olduğunu, nasıl çalıştığını ve
hangi kararların neden alındığını** eksiksiz aktarmak.

## Proje 60 saniyede

IEEE Computer Society (Atılım Üniversitesi) kulüp yönetiminin, etkinlik tarihi
belirlerken tek ekranda üç soruya cevap bulmasını sağlayan bir web uygulaması:
(1) o gün okulda sınav/tatil var mı, (2) üyeler/hedef kitle o saatte derste mi,
(3) başka bir kulüp etkinliğiyle çakışıyor mu. Merkezde büyük bir aylık takvim
var; sol panelden (Ders Programı / Sınav Programı / Akademik Takvim) yapılan her
seçim takvimde bir katman olarak beliriyor.

Tam ürün gereksinimi için **`PROJE-SPESIFIKASYONU.md`**'yu oku — bu dosya onun
"nasıl yapıldı"sını özetler. Adım adım karar geçmişi için **`DECISIONS.md`**'ye
bak (uzun ama yüksek sinyal; bu dosya onun kısaltılmışı).

**Durum:** Faz 1-5 tamamlandı, gerçek Neon DB + kulübün Google hesabıyla uçtan
uca test edildi. Vercel'e alınmadı. Bkz. `README.md` → "Kalan adımlar".

## Yığın

Next.js 16 (App Router, Turbopack) · TypeScript · React 19 · Tailwind CSS 4 ·
Drizzle ORM + Neon Postgres (serverless) · Auth.js v5 (Google OAuth) · Zod ·
date-fns/date-fns-tz · cheerio (sunucu taraflı HTML ayrıştırma) · Vitest +
Playwright. Bağımlılık minimal tutuluyor — yeni bir paket eklemeden önce
gerekçesini düşün.

> **Next.js 16 uyarısı:** Bu proje eğitim verinizdeki Next.js'ten farklı
> olabilir (`middleware.ts` kaldırıldı, yerine `proxy.ts` var — bkz.
> `AGENTS.md`/`CLAUDE.md`). Emin olmadığın API için `node_modules/next/dist/docs/`
> içine bak, tahmin etme.

## Kurulum

Adım adım kurulum `README.md`'de. Özet: `npm install` → `.env.example`'ı
`.env.local` yap ve doldur → `npx drizzle-kit push` → `npm run dev`.

## Mimari — beş karar

### 1. Sunucu-öncelikli, minimum client state

Sayfalar ve çoğu panel **Server Component** (doğrudan Drizzle ile DB'den okur).
İstemci durumu sadece gerçekten gerekince var: arama kutuları (`CourseSchedulePanel`,
`ExamSessionSearchList`, `AcademicEntrySearchList` — bunlar filtre çiplerini
`children` olarak arama kutusunun ALTINA alan client sarmalayıcılar), tik
kutuları, modal'lar. Server Component olan bir panelde interaktif bir öğe
gerekiyorsa (checkbox, arama) genelde **ayrı, küçük bir client component**'e
çıkarılır — panelin tamamı client'a çevrilmez.

### 2. Durum URL'de yaşar — "katmanlar" sistemi

Sol panellerden yapılan her seçim `?layers=` query param'ında virgülle ayrılmış
ad-alanlı kimlikler olarak tutulur (`lib/calendar/layers.ts`): `course-import:<id>`,
`exam-faculty:muh`, `academic-category:TATIL`, `view:heatmap` gibi. Bu sayede
görünüm paylaşılabilir bir bağlantı. İki istisna/nüans:

- **`category-hidden:*`** (Ders Programı/Sınav Programı/Akademik Takvim ana tik
  kutuları, `lib/calendar/category-layers.ts`): diğerlerinin TERSİ mantık — boş
  katman "gizli değil" demek, yani varsayılan (URL boşken) HEPSİ görünür.
- **`view:heatmap`**: varsayılan KAPALI, normal mantık (boş = kapalı).

Yeni bir filtre eklerken önce bu dosyaya bak, ad alanı çakışmasın.

### 3. edupage.org'a asla sunucudan istek atılmaz

`robots.txt` otomatik erişimi reddediyor (doğrulandı). Ders programı verisi
kullanıcının **kendi tarayıcısından** elle kaydedip yüklediği HTML'den geliyor
(`lib/timetable-import/parse-svg-timetable.ts` — SVG grid ayrıştırıcı, JSON blok
YOK, spesifikasyonun varsaydığından farklı gerçek yapı). Bunu hızlandırmak için
bir **bookmarklet** var (`components/upload/TimetableBookmarklet.tsx`) — sayfayı
panoya kopyalar, otomatik keşif/tarama YAPMAZ. Akademik takvim ve sınav programı
içinse gerçek kazıyıcılar var (`lib/scrapers/`), günlük cron ile çalışıyor
(`vercel.json`, `CRON_SECRET` korumalı).

### 4. Renk sistemi tek merkezden

`lib/calendar/color-system.ts` — her `EventKind` için etiket + ikon + renk
(renk körlüğü/B&W yazdırma için renk asla tek başına anlam taşımaz). Yeni bir
tür eklerken buraya ekle, rengi bileşenin içine gömme.

### 5. Roller

`admin` / `editor` / `viewer` (`users.role`). `viewer` hiçbir şeyi
düzenleyemez/silemez/içe aktaramaz — sadece okur. İzin listesi
(`ALLOWED_EMAILS`/`ADMIN_EMAILS`) ortam değişkeninde, kodda değil (açık kaynak
uyumu). `proxy.ts` tüm uygulamayı (API dahil) oturumsuz erişime kapatır.

## Veri modeli (özet — tam alan listesi `lib/db/schema/*.ts`)

| Tablo | Ne için |
|---|---|
| `users` | Google ile giriş yapan kullanıcılar, rol |
| `academic_calendar_entries` | Okul akademik takvimi (kazıyıcı ile senkron) |
| `exam_sessions` | Sınav programı (kazıyıcı ile senkron) — **bkz. Bilinen sorunlar** |
| `timetable_imports` | Elle yüklenen edupage sayfaları — `periods` (jsonb) gerçek ders saati sınırlarını taşır |
| `course_sessions` | Bir `timetable_imports` kaydından çıkan ders oturumları |
| `club_events` | Kulüp etkinlikleri (fikir/planlanıyor/onaylandı/…) |
| `day_notes` | Bir güne iliştirilmiş serbest not |
| `members` | Üye/hedef kitle listesi (uygunluk analizi için) |
| `rooms` | Derslik listesi (boş derslik bulucu için) |
| `column_mapping` | Sınav programı sütun eşlemesi kırılırsa elle düzeltme |
| `sync_runs` / `sync_changes` | Kazıyıcı çalıştırma geçmişi + değişiklik tespiti |
| `audit_log` | Kim ne zaman neyi değiştirdi |
| `rate_limits` | Manuel senkron tetikleme sınırlaması |

## Dizin haritası

```
app/
  calendar/            Ana takvim (Ay) + calendar/term (çok aylık genel bakış)
  admin/                timetable-imports (içe aktar/düzenle/sil), column-mapping, sync-runs
  availability/          Uygunluk analizi + ısı haritası
  api/                   Tüm rotalar — tablo aşağıda
components/
  calendar/              MonthGrid, DayCell, HourlyTimeline, BottomToolbar, ...
  sidebar/                Ders Programı/Sınav Programı/Akademik Takvim panelleri
  upload/                 İçe aktarma formu, bookmarklet, satır düzenleme
  events/ notes/ rooms/ search/ column-mapping/ availability/
lib/
  calendar/               Tarih/saat, katman sistemi, renk sistemi, ay/gün veri çekme
  scrapers/               Akademik takvim + sınav programı kazıyıcıları
  timetable-import/       edupage SVG ayrıştırıcı + normalize
  db/schema/              Drizzle şeması, tablo başına dosya
fixtures/                 Gerçek kaynaklardan alınmış HTML örnekleri (testler ağa dokunmaz)
```

## API uçları

| Uç | Ne yapar |
|---|---|
| `GET/POST /api/timetable-imports`, `PATCH/DELETE .../[id]` | Ders programı içe aktarma CRUD |
| `GET/POST /api/day-notes`, `PATCH/DELETE .../[id]` | Gün notları |
| `GET/POST /api/events`, `PATCH/DELETE .../[id]` | Kulüp etkinlikleri |
| `GET /api/academic-calendar`, `PATCH .../[id]` | Akademik takvim (sadece kategori override) |
| `GET /api/exam-sessions`, `/api/course-sessions`, `/api/rooms`, `/api/members` (+ `[id]`) | Salt okunur / CRUD listeler |
| `GET/PATCH/DELETE /api/column-mapping`, `POST .../preview` | Sınav programı sütun eşleme |
| `GET /api/search` | Cmd/Ctrl+K arama |
| `GET /api/export/ics` | .ics dışa aktarma |
| `GET /api/cron/sync-academic-calendar`, `/sync-exam-schedule` | `CRON_SECRET` korumalı, Vercel Cron çağırır |
| `POST /api/sync/trigger` | Admin'in elle "şimdi senkronize et" düğmesi |

## Bilinen sorunlar / açık işler (dokunmadan önce oku)

Hepsinin tam gerekçesi `DECISIONS.md`'de tarih sırasıyla var; en önemlileri:

- **`exam_sessions` kirli veri.** Gerçek üretimde 11.000+ satıra çıktı: ~3000
  tekrar eden satır grubu + bir kayıtta yıl **2924** (bariz senkron/ayrıştırma
  hatası). Sayfa performansı bu yüzden bir kez ciddi soruna yol açmıştı (tüm
  tabloyu çekip render eden bir panel 20+ saniyeye çıkmıştı) — düzeltme yapıldı
  (sorgular artık pencereli), ama **kök veri sorunu hâlâ temizlenmedi**. Senkron
  koduna dedup/upsert eklenmesi ve `exam_date > 2100` gibi satırların
  temizlenmesi kullanıcı onayı bekliyor.
- **`date` sütunları + saat dilimi varsayımı doğrulanmadı.** `node-postgres`
  `date` sütununu SUNUCUNUN yerel saatine göre gece yarısı `Date` nesnesi olarak
  kuruyor; yazma tarafı (`lib/calendar/day-notes.ts` → `parseDateOnly`) bilinçli
  UTC gece yarısı kullanıyor. Yazma ve okuma hep aynı süreçte olduğu için
  (Vercel'de ikisi de UTC) pratikte tutarlı ama hiç yazılı test edilmedi —
  üretimde bir gün kayması görülürse ilk bakılacak yer burası.
- **edupage'den toplu içe aktarma yok, olmayacak da** (robots.txt). Bookmarklet
  bunu hızlandırıyor ama her sınıfı kullanıcı hâlâ kendi açıp kaydediyor.
- **"Uygunluk analizi" ve "Boş derslik bulucu"** (spec §7.2/7.3) kodlandı ama bu
  oturumda gerçek veriyle ayrıca doğrulanmadı.
- **Vercel'e alınmadı.** `vercel.json` cron tanımları hazır ama proje henüz
  bağlanmadı, ortam değişkenleri girilmedi.

## Test

```bash
npm run test        # Vitest — ağa/DB'ye dokunmaz, kazıyıcılar fixtures/'a karşı çalışır
npm run test:e2e     # Playwright — sadece oturumdan bağımsız akışlar (spec §... , bkz. DECISIONS.md)
```

Bir değişiklik yaptıktan sonra `npx tsc --noEmit` ve `npx eslint .` da temiz
olmalı — bu repo `react-hooks/purity` gibi katı kurallar çalıştırıyor (React
Compiler), sürpriz olmasın.

## Çalışma tarzı notları

- Yorumlar sadece **neden**i açıklar, **ne** yaptığını değil (kod zaten okunaklı
  olmalı). Bir kararın gerekçesi varsa "kullanıcı isteği, TARİH" ya da
  "DECISIONS.md" referansıyla iz bırakılıyor — bu alışkanlığı sürdür.
- Belirsiz kaldığın yerde varsayım uydurma; `DECISIONS.md`'ye soru olarak yaz ya
  da kullanıcıya sor.
- Depo public — hiçbir gizli değer, kurum/şahıs bilgisi kod içine sabit
  yazılmaz. Sadece `.env.local` (gitignore'da) ve ortam değişkenleri.
