CREATE TABLE "analytics_usage_cursor" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"reported_through" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_usage_cursor_single_row" CHECK ("analytics_usage_cursor"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "daily_usage" ADD COLUMN "mcp_request_count" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_mcp_request_count_nonnegative" CHECK ("daily_usage"."mcp_request_count" >= 0);