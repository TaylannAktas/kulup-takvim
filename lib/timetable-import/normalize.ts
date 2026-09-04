import "server-only";
import { db } from "@/lib/db";
import { courseSessions, timetableImports } from "@/lib/db/schema";
import { parseEdupageTimetableSvg } from "./parse-svg-timetable";

/**
 * Yüklenen ders programı dosyasını ayrıştırıp veritabanına yazar.
 *
 * Kazıyıcılardan (`lib/scrapers/<kaynak>/diff.ts`) farklı olarak burada diff / yumuşak
 * silme YOK: bu tekrarlayan bir senkron değil, elle yapılan tek seferlik bir
 * yükleme. Her yükleme kendi `timetable_imports` kaydını ve ona bağlı
 * `course_sessions` satırlarını oluşturur; eskisini silmek ayrı bir DELETE
 * işidir (bkz. `DELETE /api/timetable-imports/[id]`).
 *
 * Ayrıştırıcı yapıyı hiç tanımazsa hata OLDUĞU GİBİ yukarı geçer — route
 * katmanı yakalayıp kullanıcıya gösterir.
 */
export async function importTimetable(params: {
  html: string;
  uploadedBy: string;
  sourceLabel: string;
  termCode?: string;
}): Promise<{ importId: string; parsedSessionCount: number; warnings: string[] }> {
  const { rows, warnings } = parseEdupageTimetableSvg(params.html);

  const [created] = await db
    .insert(timetableImports)
    .values({
      uploadedBy: params.uploadedBy,
      sourceLabel: params.sourceLabel,
      termCode: params.termCode ?? null,
      parsedSessionCount: rows.length,
      notes: warnings.length > 0 ? warnings.join("\n") : null,
    })
    .returning();

  if (rows.length > 0) {
    await db.insert(courseSessions).values(
      rows.map((row) => ({
        importId: created.id,
        courseCode: row.courseCode,
        courseName: row.courseName,
        section: row.section,
        facultyCode: row.facultyCode,
        programName: row.programName,
        classYear: row.classYear,
        weekday: row.weekday,
        startTime: row.startTime,
        endTime: row.endTime,
        room: row.room,
        instructor: row.instructor,
      }))
    );
  }

  return { importId: created.id, parsedSessionCount: rows.length, warnings };
}
