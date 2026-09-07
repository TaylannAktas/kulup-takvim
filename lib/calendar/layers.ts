/**
 * Sol panellerden yapılan seçimler takvimde "katman" olarak görünür ve URL'de
 * saklanır (spesifikasyon §6.1, §7.1 — paylaşılabilir bağlantı). Tek bir
 * `layers` query parametresi altında virgülle ayrılmış katman kimlikleri tutulur.
 *
 * Katman kimlikleri ad alanlı düz string'lerdir, örn:
 *  - "academic-category:SINAV"        (akademik takvim tür filtresi)
 *  - "exam-faculty:muh"               (sınav programı fakülte filtresi)
 *  - "exam-type:final"
 *  - "course-class:<sinif-id>"        (ders programı seçimi, Faz 4)
 *
 * Bu modül katman kimliklerinin anlamını bilmez — sadece kümeyi URL'e
 * kodlar/çözer. Anlamlandırma ilgili sidebar panelinde yapılır.
 */

const PARAM_NAME = "layers";

export function parseLayers(searchParams: URLSearchParams): Set<string> {
  const raw = searchParams.get(PARAM_NAME);
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

/** Verilen katman kümesiyle güncellenmiş bir URLSearchParams döner (immutable). */
export function withLayers(searchParams: URLSearchParams, layers: Set<string>): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (layers.size === 0) {
    next.delete(PARAM_NAME);
  } else {
    next.set(PARAM_NAME, [...layers].sort().join(","));
  }
  return next;
}

export function toggleLayer(layers: Set<string>, id: string): Set<string> {
  const next = new Set(layers);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function isLayerActive(layers: Set<string>, id: string): boolean {
  return layers.has(id);
}

export function makeLayerId(namespace: string, value: string): string {
  return `${namespace}:${value}`;
}

/**
 * Ay görünümündeki "Isı haritası" katmanı — varsayılan KAPALI (kullanıcı
 * isteği, 2026-09-08). Diğer katman kimlikleriyle aynı `layers` parametresinde
 * tutuluyor; boş/yok = kapalı, `toggleLayer`/`isLayerActive` ile aynı şekilde
 * açılıp kapanır. Eski Dönem sayfasındaki GitHub-katkı-grafiği tarzı ısı
 * haritasının (kaldırıldı) yerini alıyor, artık Ay görünümünde bir katman.
 */
export const HEATMAP_LAYER_ID = "view:heatmap";
