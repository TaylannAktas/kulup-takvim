"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UploadResponse = {
  importId: string;
  parsedSessionCount: number;
  warnings?: string[];
  error?: string | object;
};

export function TimetableUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [termCode, setTermCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ sessionCount: number; warnings?: string[] } | null>(null);
  const [pastedFileName, setPastedFileName] = useState<string | null>(null);

  /**
   * Bookmarklet panoya `{label, html}` JSON'u yazıyor (bkz. TimetableBookmarklet).
   * Düz metin panoya elle kopyalanmış saf HTML de kabul edilir (JSON.parse
   * başarısız olursa olduğu gibi HTML sayılır) — kullanıcı bookmarklet
   * kullanmadan da bir sayfanın kaynağını kopyalayıp buraya yapıştırabilsin.
   */
  async function handlePasteFromClipboard() {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      let html = text;
      let label = "";
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.html === "string") {
          html = parsed.html;
          if (typeof parsed.label === "string") label = parsed.label;
        }
      } catch {
        // JSON değil — panodaki metni doğrudan HTML say.
      }
      if (!html.trim()) {
        setError("Panoda içerik yok. Önce bookmarklet ile bir sayfa kopyalayın.");
        return;
      }
      const pastedFile = new File([html], "panodan-yapistirilan.html", { type: "text/html" });
      setFile(pastedFile);
      setPastedFileName(pastedFile.name);
      if (label.trim()) setSourceLabel(label.trim());
    } catch {
      setError(
        "Panoya erişilemedi. Tarayıcı izin isteyebilir — isterse dosyayı elle de seçebilirsiniz."
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (sourceLabel.trim()) {
        formData.append("sourceLabel", sourceLabel.trim());
      }
      if (termCode.trim()) {
        formData.append("termCode", termCode.trim());
      }

      const res = await fetch("/api/timetable-imports", {
        method: "POST",
        body: formData,
      });

      const data: UploadResponse = await res.json();

      if (!res.ok) {
        const errorMsg =
          typeof data.error === "string"
            ? data.error
            : data.error
              ? JSON.stringify(data.error)
              : "Bilinmeyen hata";
        setError(errorMsg);
        return;
      }

      setSuccess({
        sessionCount: data.parsedSessionCount,
        warnings: data.warnings,
      });

      // Clear form
      setFile(null);
      setPastedFileName(null);
      setSourceLabel("");
      setTermCode("");

      // Refresh the page to pick up new imports
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            HTML Dosyası *
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".htm,.html"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPastedFileName(null);
              }}
              disabled={loading}
              className="block flex-1 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white disabled:opacity-40"
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              disabled={loading}
              className="rounded border border-purple-600 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-40 dark:text-purple-400 dark:hover:bg-purple-950/40"
            >
              Panodan Yapıştır
            </button>
          </div>
          {pastedFileName && (
            <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">
              Panodan alındı — bookmarklet ile kopyalanan sayfa seçili.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Kaynak Etiketi
          </label>
          <input
            type="text"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="örn. ACL 1. Sınıf"
            disabled={loading}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <p className="mt-0.5 text-xs text-gray-500">
            Boş bırakılırsa dosya adı kullanılır.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Dönem Kodu
          </label>
          <input
            type="text"
            value={termCode}
            onChange={(e) => setTermCode(e.target.value)}
            placeholder="örn. 20252026guz"
            disabled={loading}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {success && (
        <div className="rounded bg-green-50 p-3 dark:bg-green-950/40">
          <p className="text-sm text-green-800 dark:text-green-300">
            İçe aktarıldı: {success.sessionCount} ders oturumu bulundu.
          </p>
          {success.warnings && success.warnings.length > 0 && (
            <details className="mt-2 text-xs text-green-700 dark:text-green-400">
              <summary className="cursor-pointer">
                ⚠ {success.warnings.length} uyarı
              </summary>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {success.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!file || loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {loading ? "Yükleniyor..." : "Dosyayı Yükle"}
      </button>
    </form>
  );
}
