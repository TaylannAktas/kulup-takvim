# Kulüp Takvim ve Etkinlik Planlama Paneli

IEEE Computer Society (Atılım Üniversitesi) yönetim kurulu için: akademik takvim, sınav
programı ve ders programını tek bir aylık takvimde renkli katmanlar hâlinde gösteren,
etkinlik planlamayı kolaylaştıran web uygulaması.

> **Durum:** Geliştirme aşamasında (Faz 1). Ayrıntılı yol haritası ve mimari kararlar için
> proje kök dizinindeki `DECISIONS.md` dosyasına bakın.

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
4. Geliştirme sunucusunu başlat:
   ```bash
   npm run dev
   ```
   [http://localhost:3000](http://localhost:3000) adresini aç.

## Testler

```bash
npx vitest run
```

Kazıyıcı testleri gerçek siteye istek atmaz; `fixtures/` altındaki kaydedilmiş HTML
örneklerine karşı çalışır.

## Önemli notlar

- Hiçbir gizli değer bu depoda **olmamalı**. `.env.local` `.gitignore`'da.
- Bu proje public/açık kaynak — katkı öncesi `DECISIONS.md`'yi okuyun, birçok tasarım
  kararının gerekçesi orada.
- Saat dilimi her yerde `Europe/Istanbul` (bkz. `lib/calendar/date-utils.ts`); veritabanı
  UTC saklar.
