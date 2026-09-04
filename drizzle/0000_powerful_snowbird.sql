CREATE TYPE "public"."academic_calendar_category" AS ENUM('SINAV', 'TATIL', 'DERS_DONEMI', 'KAYIT', 'IDARI');--> statement-breakpoint
CREATE TYPE "public"."academic_term" AS ENUM('guz', 'bahar', 'yaz');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('fikir', 'planlaniyor', 'onaylandi', 'yapildi', 'iptal');--> statement-breakpoint
CREATE TYPE "public"."exam_type" AS ENUM('arasinav', 'final', 'mazeret');--> statement-breakpoint
CREATE TYPE "public"."member_category" AS ENUM('uye', 'hedef_kitle');--> statement-breakpoint
CREATE TYPE "public"."sync_change_type" AS ENUM('eklendi', 'silindi', 'guncellendi');--> statement-breakpoint
CREATE TYPE "public"."sync_source" AS ENUM('akademik_takvim', 'sinav_programi');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('ok', 'kismi', 'hata', 'needs_mapping');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "academic_calendar_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"source_year" text NOT NULL,
	"term" "academic_term" NOT NULL,
	"start_date" date,
	"end_date" date,
	"description" text NOT NULL,
	"category" "academic_calendar_category" NOT NULL,
	"category_override" "academic_calendar_category",
	"source_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"status" "event_status" DEFAULT 'fikir' NOT NULL,
	"location" text,
	"expected_attendance" integer,
	"color_override" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conflict_flags" jsonb
);
--> statement-breakpoint
CREATE TABLE "source_column_mapping" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url_pattern" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text,
	"course_code" text,
	"course_name" text,
	"section" text,
	"faculty_code" text,
	"program_name" text,
	"class_year" text,
	"weekday" integer,
	"start_time" time,
	"end_time" time,
	"room" text,
	"instructor" text
);
--> statement-breakpoint
CREATE TABLE "timetable_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_label" text,
	"term_code" text,
	"parsed_session_count" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "day_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"body" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"faculty_code" text NOT NULL,
	"exam_type" "exam_type" NOT NULL,
	"term_code" text NOT NULL,
	"course_code" text,
	"course_name" text,
	"section" text,
	"exam_date" date,
	"start_time" time,
	"end_time" time,
	"room" text,
	"raw_row" jsonb NOT NULL,
	"source_url" text NOT NULL,
	"source_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"category" "member_category" NOT NULL,
	"faculty_code" text,
	"program_name" text,
	"class_year" text,
	"course_codes" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"code" text PRIMARY KEY NOT NULL,
	"building" text,
	"capacity" integer
);
--> statement-breakpoint
CREATE TABLE "sync_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"sync_run_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"change_type" "sync_change_type" NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "sync_source" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "sync_status" NOT NULL,
	"fetched_count" integer,
	"changed_count" integer,
	"error_detail" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_column_mapping" ADD CONSTRAINT "source_column_mapping_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sessions" ADD CONSTRAINT "course_sessions_import_id_timetable_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."timetable_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_imports" ADD CONSTRAINT "timetable_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_notes" ADD CONSTRAINT "day_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_changes" ADD CONSTRAINT "sync_changes_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;