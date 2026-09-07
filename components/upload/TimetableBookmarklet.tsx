"use client";

/**
 * edupage her sınıf sayfası için ayrı bir "Web Sayfası, Tamamı" kaydı ve elle
 * yükleme gerektiriyor (bkz. DECISIONS.md — robots.txt otomatik erişimi
 * reddediyor, o yüzden sunucu tarafında toplu kazıma yapılmıyor).
 *
 * Bu bookmarklet OTOMATİK KEŞİF/TARAMA YAPMAZ — edupage'e hiç ek istek
 * göndermez. Sadece kullanıcının ZATEN elle açtığı sayfanın DOM'unu
 * (`outerHTML`) panoya kopyalar ve içe aktarma sekmesini açar; Ctrl+S →
 * "Web Sayfası, Tamamı" → dosya seç → yükle adımlarını "bookmarklete tıkla →
 * Panodan Yapıştır'a bas" ikilisine indirir. Her sayfayı hâlâ kullanıcı kendi
 * gezinerek açıyor, robots.txt'e dokunulmuyor.
 *
 * `baseUrl` sunucudan (istek başlıklarından) prop olarak geliyor —
 * `window.location.origin`'i istemci tarafında okumak hem hydration
 * uyuşmazlığına hem de React Compiler'ın "effect içinde setState" kuralına
 * takılırdı; bileşen bu şekilde tamamen saf.
 */
export function TimetableBookmarklet({ baseUrl }: { baseUrl: string }) {
  const importUrl = `${baseUrl}/admin/timetable-imports`;
  const source = `(function(){var w=window.open(${JSON.stringify(importUrl)},'kulup-takvim-import');if(w){w.focus();}if(!navigator.clipboard||!navigator.clipboard.writeText){alert('Bu tarayıcı pano API\\'sini desteklemiyor, elle Ctrl+S kullanın.');return;}var payload=JSON.stringify({label:document.title||'',html:document.documentElement.outerHTML});navigator.clipboard.writeText(payload).then(function(){alert('Ders programı kopyalandı. Açılan sekmede "Panodan Yapıştır" düğmesine basın.');}).catch(function(err){alert('Kopyalama başarısız: '+(err&&err.message?err.message:err));});})();`;
  const href = `javascript:${encodeURIComponent(source)}`;

  return (
    <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
      <p className="mb-2 font-medium text-gray-800 dark:text-gray-200">
        Çok sayıda sınıfı hızlı içe aktarma
      </p>
      <p className="mb-2">
        Bu linki yer imleri çubuğuna sürükleyin:{" "}
        <a
          href={href}
          draggable
          onClick={(e) => {
            e.preventDefault();
            alert("Bu düğmeyi tıklamak yerine yer imleri çubuğunuza sürükleyin.");
          }}
          className="cursor-move rounded bg-purple-600 px-2 py-1 font-medium text-white"
        >
          Ders Programını Kopyala
        </a>
      </p>
      <ol className="list-inside list-decimal space-y-1">
        <li>edupage&apos;de bir sınıfın haftalık programını açın.</li>
        <li>Yukarıdaki yer imine tıklayın — sayfa panoya kopyalanır, bu sekme açılır/öne gelir.</li>
        <li>Aşağıdaki &quot;Panodan Yapıştır&quot; düğmesine basın, etiketi kontrol edip yükleyin.</li>
        <li>Sonraki sınıf için edupage sekmesine dönüp 1-3&apos;ü tekrarlayın.</li>
      </ol>
      <p className="mt-2 text-gray-400">
        Bu, sizin kendi taradığınız sayfaları hızlandırır — otomatik keşif/toplu istek atmaz,
        edupage&apos;in robots.txt&apos;ine dokunmaz.
      </p>
    </div>
  );
}
