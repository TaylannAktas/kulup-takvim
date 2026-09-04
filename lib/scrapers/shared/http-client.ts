import "server-only";

const MIN_DELAY_MS = 500;

let lastRequestAt = 0;
let inFlight: Promise<unknown> = Promise.resolve();

function userAgent(): string {
  return (
    process.env.SCRAPER_USER_AGENT ??
    "IEEE-CS-Atilim-Planner/0.1 (iletisim eksik - .env icinde SCRAPER_USER_AGENT tanimlanmamis)"
  );
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  const wait = MIN_DELAY_MS - elapsed;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

/**
 * Tek uçuşlu (single-flight), gecikmeli, özel User-Agent'lı GET isteği.
 * Kazıyıcı etiği gereği (spesifikasyon §8): istekler arasında gecikme olmalı ve
 * aynı anda birden fazla kazıma isteği gönderilmemeli.
 */
export async function fetchHtml(
  url: string,
  init?: Omit<RequestInit, "headers">
): Promise<string> {
  const run = inFlight.then(async () => {
    await throttle();
    const response = await fetch(url, {
      ...init,
      redirect: "follow",
      headers: { "User-Agent": userAgent() },
    });
    if (!response.ok) {
      throw new Error(`Kazıma isteği başarısız: ${url} -> HTTP ${response.status}`);
    }
    return response.text();
  });

  inFlight = run.catch(() => undefined);
  return run;
}

/**
 * Bir HTML sayfasındaki relatif bir bağlantıyı, o sayfanın URL'sine göre mutlak URL'e çözer.
 */
export function resolveUrl(base: string, relative: string): string {
  return new URL(relative, base).toString();
}
