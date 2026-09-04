# Kulüp Takvim ve Etkinlik Planlama Paneli

IEEE Computer Society (Atılım Üniversitesi) yönetim kurulu için: akademik takvim, sınav
programı ve ders programını tek bir aylık takvimde renkli katmanlar hâlinde gösteren,
etkinlik planlamayı kolaylaştıran web uygulaması.

> **Durum:** Faz 1-5'in tamamı kodlandı (iskele, kazıyıcılar, etkinlikler/çakışma
> denetimi, ders programı içe aktarma, dışa aktarma/arama/erişilebilirlik cilası).
> Henüz gerçek bir veritabanına/Google hesabına bağlanıp uçtan uca canlı test
> edilmedi — bkz. "Kalan adımlar" altında. Ayrıntılı yol haritası ve mimari kararlar
> için proje kök dizinindeki `DECISIONS.md` dosyasına bakın.

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

## Kalan adımlar (Faz 0 — kullanıcı tarafından)

Kod tamamlandı ama uygulama henüz gerçek bir kurulumla uçtan uca denenmedi:

- [ ] Neon Postgres projesi oluşturulup `DATABASE_URL` girildi
- [ ] Google Cloud OAuth istemcisi oluşturulup `AUTH_GOOGLE_ID`/`SECRET` girildi
- [ ] GitHub'da genel (public) depo açılıp bu kod push edildi
- [ ] Vercel projesi bağlanıp cron zamanlaması (`vercel.json`) ve ortam değişkenleri kuruldu
- [ ] Gerçek bir edupage ders programı içe aktarılıp Ders Programı paneli/uygunluk
      analizi/boş derslik bulucu gerçek veriyle denendi

## Önemli notlar

- Hiçbir gizli değer bu depoda **olmamalı**. `.env.local` `.gitignore`'da.
- Bu proje public/açık kaynak — katkı öncesi `DECISIONS.md`'yi okuyun, birçok tasarım
  kararının gerekçesi ve spesifikasyondan sapmalar orada.
- Saat dilimi her yerde `Europe/Istanbul` (bkz. `lib/calendar/date-utils.ts`); veritabanı
  UTC saklar.
