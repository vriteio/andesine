ALTER TABLE "comment_threads" ADD COLUMN "suggestion" jsonb;--> statement-breakpoint
ALTER TABLE "comment_threads" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "suggestion";--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "applied_at";