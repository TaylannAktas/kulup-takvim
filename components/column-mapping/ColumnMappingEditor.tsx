"use client";

import { useState } from "react";

type FieldKey = "courseCode" | "courseName" | "room" | "examDate" | "startTime" | "endTime";

const FIELD_LABELS: Record<FieldKey, string> = {
  courseCode: "Ders Kodu",
  courseName: "Dersin Adı",
  room: "Sınıf / Derslik",
  examDate: "Tarih",
  startTime: "Başlangıç Saati",
  endTime: "Bitiş Saati",
};

const REQUIRED_FIELDS: FieldKey[] = ["courseCode", "examDate", "startTime", "endTime"];
const ALL_FIELDS: FieldKey[] = [...REQUIRED_FIELDS, "courseName", "room"];

type PreviewResponse = {
  sheetUrl: string;
  rows: string[][];
  totalRows: number;
  detection:
    | { needsManualMapping: false; mapping: Record<FieldKey, number | null>; headerRowIndex: number }
    | { needsManualMapping: true; reason: string; headerRowIndex: number | null };
};

/**
 * Spesifikasyon §4.2: sınav programı kaynağının sütun sırası bozulduğunda
 * (veya ilk kez görüldüğünde) admin'in elle eşleme yapabildiği ekran.
 * "Bir kez seçilir, sonraki senkronlarda kullanılır."
 */
export function ColumnMappingEditor() {
  const [rootUrl, setRootUrl] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null);
  const [columnAssignments, setColumnAssignments] = useState<Record<number, FieldKey | "">>({});
  const [scope, setScope] = useState<"exact" | "faculty">("exact");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function applyDetection(data: PreviewResponse) {
    const rowIndex = data.detection.headerRowIndex;
    setHeaderRowIndex(rowIndex);

    const assignments: Record<number, FieldKey | ""> = {};
    if (!data.detection.needsManualMapping) {
      for (const [field, index] of Object.entries(data.detection.mapping)) {
        if (typeof index === "number") assignments[index] = field as FieldKey;
      }
    }
    setColumnAssignments(assignments);
  }

  async function handlePreview() {
    setLoading(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const res = await fetch("/api/column-mapping/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Önizleme başarısız.");
        return;
      }
      setPreview(data);
      applyDetection(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function assignedColumnFor(field: FieldKey): number | null {
    const entry = Object.entries(columnAssignments).find(([, f]) => f === field);
    return entry ? Number(entry[0]) : null;
  }

  function handleAssign(columnIndex: number, field: FieldKey | "") {
    setColumnAssignments((prev) => {
      const next = { ...prev };
      // Aynı alan başka bir sütuna zaten atanmışsa önce onu boşalt (bir alan tek sütuna karşılık gelir).
      for (const key of Object.keys(next)) {
        if (next[Number(key)] === field && field !== "") delete next[Number(key)];
      }
      if (field === "") delete next[columnIndex];
      else next[columnIndex] = field;
      return next;
    });
  }

  const missingRequired = REQUIRED_FIELDS.filter((f) => assignedColumnFor(f) === null);
  const canSave = preview && headerRowIndex !== null && missingRequired.length === 0;

  async function handleSave() {
    if (!canSave || headerRowIndex === null) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const columns = {
        courseCode: assignedColumnFor("courseCode")!,
        examDate: assignedColumnFor("examDate")!,
        startTime: assignedColumnFor("startTime")!,
        endTime: assignedColumnFor("endTime")!,
        courseName: assignedColumnFor("courseName"),
        room: assignedColumnFor("room"),
      };
      const res = await fetch("/api/column-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootUrl, scope, headerRowIndex, columns }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kaydedilemedi.");
        return;
      }
      setResult(
        `Kaydedildi. Yeniden senkron: ${data.syncResult.status}` +
          (data.syncResult.fetchedCount != null ? ` (${data.syncResult.fetchedCount} kayıt)` : "")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="url"
          value={rootUrl}
          onChange={(e) => setRootUrl(e.target.value)}
          placeholder="https://dersprogramiyukle.atilim.edu.tr/20252026guzarasinav/muh"
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={handlePreview}
          disabled={loading || !rootUrl}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
        >
          Önizle
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && <p className="text-sm text-green-700 dark:text-green-400">{result}</p>}

      {preview && (
        <div className="flex flex-col gap-3">
          {preview.detection.needsManualMapping && (
            <p className="rounded bg-yellow-50 p-2 text-sm text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
              Yapısal tespit başarısız: {preview.detection.reason}
            </p>
          )}
          {!preview.detection.needsManualMapping && (
            <p className="rounded bg-green-50 p-2 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
              Yapısal tespit başarılı — aşağıdaki eşleme otomatik önerildi, isterseniz düzeltin.
            </p>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">
              Başlık satırını seçin ({preview.totalRows} satırdan ilk {preview.rows.length} tanesi gösteriliyor):
            </p>
            <div className="max-h-48 overflow-auto rounded border border-gray-200 text-xs dark:border-gray-700">
              <table className="w-full border-collapse">
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr
                      key={index}
                      onClick={() => setHeaderRowIndex(index)}
                      className={[
                        "cursor-pointer border-b border-gray-100 dark:border-gray-800",
                        headerRowIndex === index ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-gray-50 dark:hover:bg-gray-900",
                      ].join(" ")}
                    >
                      <td className="px-2 py-1 font-mono text-gray-400">{index}</td>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="whitespace-nowrap px-2 py-1">
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {headerRowIndex !== null && preview.rows[headerRowIndex] && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">
                Her sütunun hangi alana karşılık geldiğini seçin (satır {headerRowIndex}):
              </p>
              <div className="flex flex-wrap gap-3">
                {preview.rows[headerRowIndex].map((cell, columnIndex) => (
                  <div key={columnIndex} className="flex w-40 flex-col gap-1">
                    <span className="truncate text-xs text-gray-500" title={cell}>
                      {cell || `(sütun ${columnIndex})`}
                    </span>
                    <select
                      value={columnAssignments[columnIndex] ?? ""}
                      onChange={(e) => handleAssign(columnIndex, e.target.value as FieldKey | "")}
                      className="rounded border border-gray-300 px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                    >
                      <option value="">—</option>
                      {ALL_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {FIELD_LABELS[field]}
                          {REQUIRED_FIELDS.includes(field) ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {missingRequired.length > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  Eksik zorunlu alanlar: {missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={scope === "exact"} onChange={() => setScope("exact")} />
              Sadece bu URL
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={scope === "faculty"} onChange={() => setScope("faculty")} />
              Bu fakültenin her dönemi
            </label>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || loading}
              className="ml-auto rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-40"
            >
              Kaydet ve yeniden senkronla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
