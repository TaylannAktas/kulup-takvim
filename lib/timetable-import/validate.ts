/**
 * Yüklenen ders programı dosyasının kabul kontrolü.
 *
 * Saf fonksiyon: DB/ağ yok, `server-only` yok — hem route handler'dan hem
 * (ileride) istemci tarafındaki yükleme formundan çağrılabilsin diye.
 */

/** 10 MB. Gerçek fixture ~53 KB; SVG gömülü kayıtlar büyüyebildiği için bol pay. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".htm", ".html"];

/**
 * Tarayıcılar aynı dosya için farklı MIME üretiyor (Chrome `text/html`,
 * bazı Windows kurulumları `application/octet-stream`, kimi zaman boş string).
 * Bu yüzden MIME tek başına reddetme sebebi değil: uzantı doğruysa geçiyor.
 */
const ALLOWED_MIME_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "application/octet-stream",
  "",
];

export type UploadValidationResult = { ok: true } | { ok: false; error: string };

export function validateUploadedFile(file: {
  size: number;
  type: string;
  name: string;
}): UploadValidationResult {
  if (!file.name) {
    return { ok: false, error: "Dosya adı okunamadı." };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "Dosya boş görünüyor." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return {
      ok: false,
      error: `Dosya çok büyük (en fazla ${limitMb} MB olmalı).`,
    };
  }

  const name = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mime = (file.type ?? "").toLowerCase().split(";")[0].trim();
  const hasAllowedMime = ALLOWED_MIME_TYPES.includes(mime);

  // Uzantı yanlışsa reddet. Uzantı doğruysa MIME'a bakma (tarayıcılar tutarsız),
  // ama uzantı da MIME de tanınmıyorsa kesin reddet.
  if (!hasAllowedExtension) {
    return {
      ok: false,
      error:
        "Yalnızca .htm / .html dosyaları kabul ediliyor. edupage sayfasını " +
        'tarayıcıdan "Web Sayfası, Tamamı" olarak kaydedin.',
    };
  }

  if (!hasAllowedMime && !mime.startsWith("text/")) {
    return {
      ok: false,
      error: `Dosya türü desteklenmiyor ("${file.type}"). HTML dosyası bekleniyor.`,
    };
  }

  return { ok: true };
}
