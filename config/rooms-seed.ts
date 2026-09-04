/**
 * Derslik listesi için başlangıç noktası — kazıyıcı yok, spec §2.3'e uygun
 * olarak elle düzenlenebilir bir yapılandırma dosyası.
 *
 * Buradaki derslik kodları edupage'den içe aktarılan gerçek bir ders
 * programında görülenlerdir (bkz. fixtures/edupage/sinif-programi-ornek.htm)
 * — **kapsamlı bir liste değil**, sadece tek bir sınıfın programında rastlanan
 * birkaç oda. `building`/`capacity` bilgisi tahmindir, doğrulanmamıştır;
 * gerçek değerlerle güncelleyin. Yeni dersler içe aktarıldıkça
 * `course_sessions.room` içinde görülen ama burada olmayan oda kodları da
 * mevcut olabilir — `scripts/seed-rooms.ts` sadece burada LİSTELENENLERİ
 * upsert eder, course_sessions'taki tüm benzersiz odaları otomatik eklemez.
 */
export const ROOMS_SEED: Array<{ code: string; building: string | null; capacity: number | null }> = [
  { code: "C102", building: null, capacity: null },
  { code: "C103", building: null, capacity: null },
  { code: "C304", building: null, capacity: null },
  { code: "C305", building: null, capacity: null },
  { code: "C307", building: null, capacity: null },
  { code: "O-223 İlk ve Acil Yard. Lab.", building: null, capacity: null },
  { code: "Multidisipliner iç oda", building: null, capacity: null },
  { code: "MAKET LAB.", building: null, capacity: null },
];
