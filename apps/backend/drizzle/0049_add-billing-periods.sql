CREATE TABLE "billing_periods" (
	"workspace_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"api_calls" bigint DEFAULT 0 NOT NULL,
	"ai_credits" bigint DEFAULT 0 NOT NULL,
	"seats" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "billing_periods_workspace_id_period_start_pk" PRIMARY KEY("workspace_id","period_start")
);
--> statement-breakpoint
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Past months' usage from the daily counts; their seats are unknown.
INSERT INTO "billing_periods" ("workspace_id", "period_start", "api_calls", "ai_credits")
SELECT "workspace_id", date_trunc('month', "usage_date")::date, sum("request_count"), sum("ai_credit_count")
FROM "daily_usage"
GROUP BY 1, 2;
