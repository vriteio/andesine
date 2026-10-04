CREATE TYPE "public"."usage_meter" AS ENUM('api-calls', 'ai-credits');--> statement-breakpoint
DROP INDEX "usage_ledger_pending_workspace_date_unique";--> statement-breakpoint
ALTER TABLE "daily_usage" ADD COLUMN "ai_credit_count" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD COLUMN "meter" "usage_meter" DEFAULT 'api-calls' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_ledger_pending_workspace_date_meter_unique" ON "usage_ledger" USING btree ("workspace_id","usage_date","meter") WHERE "usage_ledger"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_ai_credit_count_nonnegative" CHECK ("daily_usage"."ai_credit_count" >= 0);