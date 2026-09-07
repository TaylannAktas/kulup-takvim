# Kulüp Takvim ve Etkinlik Planlama Paneli

IEEE Computer Society (Atılım Üniversitesi) yönetim kurulu için: akademik takvim, sınav
programı ve ders programını tek bir aylık takvimde renkli katmanlar hâlinde gösteren,
etkinlik planlamayı kolaylaştıran web uygulaması.

> **Durum:** Faz 1-5'in tamamı kodlandı, gerçek bir Neon veritabanı + kulübün
> Google hesabıyla uçtan uca canlı test edildi VE Vercel'e alındı:
> **https://kulup-takvim-deploy.vercel.app**. Yeni katılan geliştiriciler önce
> **`EKIP.md`**'yi okumalı; ayrıntılı yol haritası ve mimari kararlar için
> `DECISIONS.md`'ye bakın.

## Kurulum

1. Bağımlılıkları kur:
   ```bash
   npm install
   ```
2. `.env.example` dosyasını `.env.local` olarak kopyala ve değerleri doldur:
   ```bash
   cp .env.example .env.local
   ```
   Gerekli değerler ve nereden alınacakları:
   - `DATABASE_URL` — bir [Neon](https://neon.tech) Postgres projesi oluşturup bağlantı dizesini buraya yapıştırın.
   - `AUTH_SECRET` — `npx auth secret` ile üretilebilir.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google Cloud Console'da bu proje için ayrı bir OAuth istemcisi oluşturun (yönlendirme URI'si: `http://localhost:3000/api/auth/callback/google` ve canlı domain karşılığı).
   - `ALLOWED_EMAILS` — uygulamaya girebilecek e-postalar, virgülle ayrılmış.
   - `ADMIN_EMAILS` — `ALLOWED_EMAILS`'in alt kümesi, admin rolü verilecek e-postalar.
   - `CRON_SECRET` — rastgele bir değer (örn. `openssl rand -hex 32`).
   - `SCRAPER_USER_AGENT` — kazıyıcıların kullanacağı User-Agent, iletişim bilgisi içermeli.
3. Veritabanı şemasını uygula:
   ```bash
   npx drizzle-kit push
   ```
4. (Opsiyonel) Başlangıç derslik listesini yükle:
   ```bash
   npm run seed:rooms
   ```
5. Geliştirme sunucusunu başlat:
   ```bash
   npm run dev
   ```
   [http://localhost:3000](http://localhost:3000) adresini aç.

## Testler

```bash
npm run test        # birim testleri (Vitest) — ağa/DB'ye dokunmaz
npm run test:e2e     # Playwright — sadece oturumdan bağımsız akışlar (bkz. DECISIONS.md)
```

Kazıyıcı testleri gerçek siteye istek atmaz; `fixtures/` altındaki kaydedilmiş HTML
örneklerine karşı çalışır.

## Yayına alma

Canlı: **https://kulup-takvim-deploy.vercel.app** (Vercel, `taylannaktas` kişisel hesabı,
proje `kulup-takvim-deploy`).

**Git entegrasyonu bağlı DEĞİL.** Vercel Hobby planı, commit mesajında
`Co-Authored-By:` satırı olan commit'leri (bu depodaki hemen hemen hepsi) sessizce
engelliyor — bkz. `DECISIONS.md`. Bu yüzden yeni bir sürümü yayınlamak için git
geçmişi olmayan bir kopyadan elle dağıtmak gerekiyor:

```bash
rm -rf /tmp/kulup-takvim-deploy && mkdir -p /tmp/kulup-takvim-deploy
git archive HEAD | tar -x -C /tmp/kulup-takvim-deploy
cd /tmp/kulup-takvim-deploy
npx vercel link --project kulup-takvim-deploy --yes   # ilk seferde .vercel/ klasörünü bağlar
npx vercel --prod --yes
```

Ortam değişkenleri zaten Vercel'de duruyor (`vercel env ls production` ile görülebilir);
yeni bir değişken eklemek için `vercel env add <AD> production --value <DEĞER>`.

## Kalan adımlar

- [x] Neon Postgres projesi oluşturulup `DATABASE_URL` girildi
- [x] Google Cloud OAuth istemcisi oluşturulup `AUTH_GOOGLE_ID`/`SECRET` girildi
- [x] GitHub'da genel (public) depo açılıp bu kod push edildi
- [x] Vercel projesi kuruldu, cron zamanlaması (`vercel.json`) ve ortam değişkenleri
      girildi — **not:** Git entegrasyonuyla DEĞİL, git geçmişi olmayan bir kopyadan
      `vercel --prod` ile dağıtıldı (bkz. `DECISIONS.md` "Vercel'e yayına alma" — Hobby
      planı `Co-Authored-By` satırı olan commit'leri sessizce engelliyor). Yani **push
      etmek otomatik yayınlamaz**, elle yeniden dağıtım gerekiyor (aşağıya bak).
- [x] Gerçek bir edupage ders programı içe aktarılıp Ders Programı paneli/takvim
      gerçek veriyle denendi — "Uygunluk analizi" ve "Boş derslik bulucu" (spec §7.2/7.3)
      henüz gerçek veriyle ayrıca doğrulanmadı
- [ ] `exam_sessions` tablosundaki bilinen veri sorunları temizlenmedi (bkz.
      `DECISIONS.md` "Bilinen veri sorunları" — tekrar eden satırlar + bir kayıtta
      2924 yılına ait bozuk tarih)

## Önemli notlar

- Hiçbir gizli değer bu depoda **olmamalı**. `.env.local` `.gitignore`'da.
- Bu proje public/açık kaynak — katkı öncesi `DECISIONS.md`'yi okuyun, birçok tasarım
  kararının gerekçesi ve spesifikasyondan sapmalar orada.
- Saat dilimi her yerde `Europe/Istanbul` (bkz. `lib/calendar/date-utils.ts`); veritabanı
  UTC saklar.
