CREATE TYPE "public"."outbound_attempt_outcome" AS ENUM('in_flight', 'succeeded', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."outbound_delivery_state" AS ENUM('pending', 'in_flight', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."outbound_run_stop_reason" AS ENUM('retry_exhausted', 'expired', 'disabled', 'endpoint_deleted', 'destination_changed', 'selection_changed', 'access_revoked', 'destination_policy', 'test_completed');--> statement-breakpoint
CREATE TYPE "public"."outbound_run_trigger" AS ENUM('automatic', 'manual', 'test');--> statement-breakpoint
CREATE TYPE "public"."webhook_failure_category" AS ENUM('http_status', 'timeout', 'network', 'destination_policy', 'internal');--> statement-breakpoint
ALTER TYPE "public"."key_permission" ADD VALUE 'webhooks' BEFORE 'ai-answers';--> statement-breakpoint
ALTER TYPE "public"."key_permission" ADD VALUE 'read:webhooks' BEFORE 'ai-answers';--> statement-breakpoint
ALTER TYPE "public"."permission" ADD VALUE 'webhooks' BEFORE 'workspace';--> statement-breakpoint
ALTER TYPE "public"."permission" ADD VALUE 'read:webhooks' BEFORE 'workspace';--> statement-breakpoint
CREATE TABLE "outbound_event_resources" (
	"workspace_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"resource_kind" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"side" text NOT NULL,
	"depth" integer NOT NULL,
	"collection_id" uuid,
	"restricted" boolean NOT NULL,
	CONSTRAINT "outbound_event_resources_event_id_resource_kind_resource_id_side_depth_pk" PRIMARY KEY("event_id","resource_kind","resource_id","side","depth"),
	CONSTRAINT "outbound_resources_kind_valid" CHECK ("outbound_event_resources"."resource_kind" in ('entry', 'collection')),
	CONSTRAINT "outbound_resources_side_valid" CHECK ("outbound_event_resources"."side" in ('before', 'after')),
	CONSTRAINT "outbound_resources_depth_valid" CHECK ("outbound_event_resources"."depth" >= 0),
	CONSTRAINT "outbound_resources_root_valid" CHECK ("outbound_event_resources"."collection_id" is not null or not "outbound_event_resources"."restricted")
);
--> statement-breakpoint
CREATE TABLE "outbound_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"subject" jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"test" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbound_events_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "outbound_events_version_valid" CHECK ("outbound_events"."schema_version" = 1),
	CONSTRAINT "outbound_events_payload_bounded" CHECK (jsonb_typeof("outbound_events"."subject") = 'object' and jsonb_typeof("outbound_events"."data") = 'object' and octet_length("outbound_events"."subject"::text) <= 1024 and octet_length("outbound_events"."data"::text) <= 262144)
);
--> statement-breakpoint
CREATE TABLE "outbound_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"selected_revision" integer NOT NULL,
	"payload" "bytea" NOT NULL,
	"state" "outbound_delivery_state" DEFAULT 'pending' NOT NULL,
	"retention_days" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "outbound_deliveries_event_endpoint_unique" UNIQUE("event_id","endpoint_id"),
	CONSTRAINT "outbound_deliveries_owner_expiry_unique" UNIQUE("workspace_id","id","endpoint_id","expires_at"),
	CONSTRAINT "outbound_deliveries_payload_bounded" CHECK (octet_length("outbound_deliveries"."payload") between 1 and 262144),
	CONSTRAINT "outbound_deliveries_retention_valid" CHECK ("outbound_deliveries"."retention_days" > 0 and "outbound_deliveries"."expires_at" = "outbound_deliveries"."created_at" + "outbound_deliveries"."retention_days" * interval '24 hours')
);
--> statement-breakpoint
CREATE TABLE "outbound_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"lease_token" uuid NOT NULL,
	"worker_id" varchar(200) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"outcome" "outbound_attempt_outcome" DEFAULT 'in_flight' NOT NULL,
	"http_status" integer,
	"failure_category" "webhook_failure_category",
	"late_result" jsonb,
	CONSTRAINT "outbound_attempts_run_number_unique" UNIQUE("run_id","number"),
	CONSTRAINT "outbound_attempts_lease_unique" UNIQUE("lease_token"),
	CONSTRAINT "outbound_attempts_late_result_bounded" CHECK ("outbound_delivery_attempts"."late_result" is null or (jsonb_typeof("outbound_delivery_attempts"."late_result") = 'object' and octet_length("outbound_delivery_attempts"."late_result"::text) <= 512)),
	CONSTRAINT "outbound_attempts_numbers_valid" CHECK ("outbound_delivery_attempts"."number" > 0 and ("outbound_delivery_attempts"."duration_ms" is null or "outbound_delivery_attempts"."duration_ms" >= 0) and ("outbound_delivery_attempts"."http_status" is null or "outbound_delivery_attempts"."http_status" between 100 and 599)),
	CONSTRAINT "outbound_attempts_times_valid" CHECK (("outbound_delivery_attempts"."outcome" = 'in_flight' and "outbound_delivery_attempts"."finished_at" is null and "outbound_delivery_attempts"."duration_ms" is null and "outbound_delivery_attempts"."http_status" is null and "outbound_delivery_attempts"."failure_category" is null) or ("outbound_delivery_attempts"."outcome" <> 'in_flight' and "outbound_delivery_attempts"."finished_at" is not null and "outbound_delivery_attempts"."finished_at" >= "outbound_delivery_attempts"."started_at")),
	CONSTRAINT "outbound_attempts_result_valid" CHECK (
      ("outbound_delivery_attempts"."outcome" = 'succeeded' and "outbound_delivery_attempts"."http_status" is not null and "outbound_delivery_attempts"."http_status" between 200 and 299 and "outbound_delivery_attempts"."failure_category" is null)
      or ("outbound_delivery_attempts"."outcome" = 'failed' and "outbound_delivery_attempts"."failure_category" is not null and ("outbound_delivery_attempts"."http_status" is null or "outbound_delivery_attempts"."http_status" not between 200 and 299))
      or ("outbound_delivery_attempts"."outcome" in ('unknown', 'in_flight') and "outbound_delivery_attempts"."http_status" is null and "outbound_delivery_attempts"."failure_category" is null)
    )
);
--> statement-breakpoint
CREATE TABLE "outbound_delivery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"trigger" "outbound_run_trigger" NOT NULL,
	"configuration_revision" integer NOT NULL,
	"destination_revision" integer NOT NULL,
	"execution_generation" integer NOT NULL,
	"state" "outbound_delivery_state" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"stop_reason" "outbound_run_stop_reason",
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"worker_id" varchar(200),
	CONSTRAINT "outbound_runs_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "outbound_runs_delivery_number_unique" UNIQUE("delivery_id","number"),
	CONSTRAINT "outbound_runs_numbers_valid" CHECK ("outbound_delivery_runs"."number" > 0 and "outbound_delivery_runs"."execution_generation" > 0),
	CONSTRAINT "outbound_runs_deadline_valid" CHECK ("outbound_delivery_runs"."deadline_at" > "outbound_delivery_runs"."created_at" and "outbound_delivery_runs"."deadline_at" <= "outbound_delivery_runs"."expires_at" and "outbound_delivery_runs"."deadline_at" <= "outbound_delivery_runs"."created_at" + interval '72 hours'),
	CONSTRAINT "outbound_runs_state_valid" CHECK (
      ("outbound_delivery_runs"."state" = 'pending' and "outbound_delivery_runs"."next_attempt_at" is not null and "outbound_delivery_runs"."finished_at" is null and "outbound_delivery_runs"."lease_token" is null and "outbound_delivery_runs"."lease_expires_at" is null and "outbound_delivery_runs"."worker_id" is null and "outbound_delivery_runs"."stop_reason" is null)
      or ("outbound_delivery_runs"."state" = 'in_flight' and "outbound_delivery_runs"."next_attempt_at" is null and "outbound_delivery_runs"."finished_at" is null and "outbound_delivery_runs"."lease_token" is not null and "outbound_delivery_runs"."lease_expires_at" is not null and "outbound_delivery_runs"."worker_id" is not null and "outbound_delivery_runs"."stop_reason" is null)
      or ("outbound_delivery_runs"."state" in ('succeeded', 'failed', 'cancelled') and "outbound_delivery_runs"."finished_at" is not null and "outbound_delivery_runs"."next_attempt_at" is null and "outbound_delivery_runs"."lease_token" is null and "outbound_delivery_runs"."lease_expires_at" is null and "outbound_delivery_runs"."worker_id" is null)
    ),
	CONSTRAINT "outbound_runs_times_valid" CHECK (("outbound_delivery_runs"."next_attempt_at" is null or ("outbound_delivery_runs"."next_attempt_at" >= "outbound_delivery_runs"."created_at" and "outbound_delivery_runs"."next_attempt_at" < "outbound_delivery_runs"."deadline_at")) and ("outbound_delivery_runs"."finished_at" is null or "outbound_delivery_runs"."finished_at" >= "outbound_delivery_runs"."created_at") and ("outbound_delivery_runs"."lease_expires_at" is null or "outbound_delivery_runs"."lease_expires_at" > "outbound_delivery_runs"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoint_revisions" (
	"workspace_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"destination_revision" integer NOT NULL,
	"configuration" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoint_revisions_workspace_id_endpoint_id_revision_pk" PRIMARY KEY("workspace_id","endpoint_id","revision"),
	CONSTRAINT "webhook_revisions_destination_unique" UNIQUE("workspace_id","endpoint_id","revision","destination_revision"),
	CONSTRAINT "webhook_revisions_numbers_valid" CHECK ("webhook_endpoint_revisions"."revision" >= "webhook_endpoint_revisions"."destination_revision" and "webhook_endpoint_revisions"."destination_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"event_types" text[] NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"collections" jsonb NOT NULL,
	"channels" jsonb NOT NULL,
	"restricted_content" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"destination_revision" integer DEFAULT 1 NOT NULL,
	"execution_generation" integer DEFAULT 1 NOT NULL,
	"current_secret_ciphertext" "bytea",
	"previous_secret_ciphertext" "bytea",
	"previous_secret_expires_at" timestamp with time zone,
	"secret_rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_reason" text DEFAULT 'manual',
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"first_failure_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_failure_category" "webhook_failure_category",
	"last_success_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "webhook_endpoints_name_valid" CHECK (length(btrim("webhook_endpoints"."name")) > 0),
	CONSTRAINT "webhook_endpoints_version_valid" CHECK ("webhook_endpoints"."schema_version" = 1),
	CONSTRAINT "webhook_endpoints_revisions_valid" CHECK ("webhook_endpoints"."revision" >= "webhook_endpoints"."destination_revision" and "webhook_endpoints"."destination_revision" > 0 and "webhook_endpoints"."execution_generation" > 0),
	CONSTRAINT "webhook_endpoints_selection_valid" CHECK (cardinality("webhook_endpoints"."event_types") > 0),
	CONSTRAINT "webhook_endpoints_disabled_valid" CHECK (("webhook_endpoints"."enabled" and "webhook_endpoints"."disabled_reason" is null) or (not "webhook_endpoints"."enabled" and "webhook_endpoints"."disabled_reason" is not null and "webhook_endpoints"."disabled_reason" in ('manual', 'failures'))),
	CONSTRAINT "webhook_endpoints_secrets_valid" CHECK (("webhook_endpoints"."deleted_at" is null and "webhook_endpoints"."current_secret_ciphertext" is not null and octet_length("webhook_endpoints"."current_secret_ciphertext") > 0) or ("webhook_endpoints"."deleted_at" is not null and not "webhook_endpoints"."enabled" and "webhook_endpoints"."current_secret_ciphertext" is null and "webhook_endpoints"."previous_secret_ciphertext" is null)),
	CONSTRAINT "webhook_endpoints_overlap_valid" CHECK (("webhook_endpoints"."previous_secret_ciphertext" is null and "webhook_endpoints"."previous_secret_expires_at" is null) or ("webhook_endpoints"."previous_secret_ciphertext" is not null and octet_length("webhook_endpoints"."previous_secret_ciphertext") > 0 and "webhook_endpoints"."previous_secret_expires_at" is not null and "webhook_endpoints"."previous_secret_expires_at" > "webhook_endpoints"."secret_rotated_at")),
	CONSTRAINT "webhook_endpoints_failure_streak_valid" CHECK (("webhook_endpoints"."consecutive_failures" = 0 and "webhook_endpoints"."first_failure_at" is null) or ("webhook_endpoints"."consecutive_failures" > 0 and "webhook_endpoints"."first_failure_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "outbound_event_resources" ADD CONSTRAINT "outbound_resources_event_fk" FOREIGN KEY ("workspace_id","event_id") REFERENCES "public"."outbound_events"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_events" ADD CONSTRAINT "outbound_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_deliveries" ADD CONSTRAINT "outbound_deliveries_endpoint_fk" FOREIGN KEY ("workspace_id","endpoint_id") REFERENCES "public"."webhook_endpoints"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_deliveries" ADD CONSTRAINT "outbound_deliveries_event_fk" FOREIGN KEY ("workspace_id","event_id") REFERENCES "public"."outbound_events"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_deliveries" ADD CONSTRAINT "outbound_deliveries_revision_fk" FOREIGN KEY ("workspace_id","endpoint_id","selected_revision") REFERENCES "public"."webhook_endpoint_revisions"("workspace_id","endpoint_id","revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_delivery_attempts" ADD CONSTRAINT "outbound_attempts_run_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."outbound_delivery_runs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_delivery_runs" ADD CONSTRAINT "outbound_runs_delivery_fk" FOREIGN KEY ("workspace_id","delivery_id","endpoint_id","expires_at") REFERENCES "public"."outbound_deliveries"("workspace_id","id","endpoint_id","expires_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_delivery_runs" ADD CONSTRAINT "outbound_runs_revision_fk" FOREIGN KEY ("workspace_id","endpoint_id","configuration_revision","destination_revision") REFERENCES "public"."webhook_endpoint_revisions"("workspace_id","endpoint_id","revision","destination_revision") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoint_revisions" ADD CONSTRAINT "webhook_revisions_endpoint_fk" FOREIGN KEY ("workspace_id","endpoint_id") REFERENCES "public"."webhook_endpoints"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbound_resources_collection_idx" ON "outbound_event_resources" USING btree ("workspace_id","collection_id","event_id");--> statement-breakpoint
CREATE INDEX "outbound_resources_resource_idx" ON "outbound_event_resources" USING btree ("workspace_id","resource_kind","resource_id","event_id");--> statement-breakpoint
CREATE INDEX "outbound_events_workspace_created_idx" ON "outbound_events" USING btree ("workspace_id","created_at","id");--> statement-breakpoint
CREATE INDEX "outbound_events_operation_idx" ON "outbound_events" USING btree ("workspace_id","operation_id");--> statement-breakpoint
CREATE INDEX "outbound_deliveries_endpoint_created_idx" ON "outbound_deliveries" USING btree ("workspace_id","endpoint_id","created_at","id");--> statement-breakpoint
CREATE INDEX "outbound_deliveries_endpoint_state_idx" ON "outbound_deliveries" USING btree ("workspace_id","endpoint_id","state");--> statement-breakpoint
CREATE INDEX "outbound_deliveries_expiry_idx" ON "outbound_deliveries" USING btree ("expires_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_attempts_one_in_flight_idx" ON "outbound_delivery_attempts" USING btree ("run_id") WHERE "outbound_delivery_attempts"."outcome" = 'in_flight';--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_runs_one_active_delivery_idx" ON "outbound_delivery_runs" USING btree ("delivery_id") WHERE "outbound_delivery_runs"."state" in ('pending', 'in_flight');--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_runs_one_in_flight_endpoint_idx" ON "outbound_delivery_runs" USING btree ("endpoint_id") WHERE "outbound_delivery_runs"."state" = 'in_flight';--> statement-breakpoint
CREATE INDEX "outbound_runs_due_idx" ON "outbound_delivery_runs" USING btree ("next_attempt_at","id") WHERE "outbound_delivery_runs"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "outbound_runs_lease_expiry_idx" ON "outbound_delivery_runs" USING btree ("lease_expires_at","id") WHERE "outbound_delivery_runs"."state" = 'in_flight';--> statement-breakpoint
CREATE INDEX "outbound_runs_deadline_idx" ON "outbound_delivery_runs" USING btree ("deadline_at","id") WHERE "outbound_delivery_runs"."state" in ('pending', 'in_flight');--> statement-breakpoint
CREATE INDEX "outbound_runs_destination_idx" ON "outbound_delivery_runs" USING btree ("workspace_id","endpoint_id","destination_revision","state");--> statement-breakpoint
CREATE INDEX "outbound_runs_revision_idx" ON "outbound_delivery_runs" USING btree ("workspace_id","endpoint_id","configuration_revision");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_workspace_created_idx" ON "webhook_endpoints" USING btree ("workspace_id","created_at","id");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_failure_period_idx" ON "webhook_endpoints" USING btree ("first_failure_at") WHERE "webhook_endpoints"."enabled" and "webhook_endpoints"."deleted_at" is null and "webhook_endpoints"."first_failure_at" is not null;--> statement-breakpoint
CREATE INDEX "webhook_endpoints_secret_expiry_idx" ON "webhook_endpoints" USING btree ("previous_secret_expires_at") WHERE "webhook_endpoints"."previous_secret_expires_at" is not null;--> statement-breakpoint
CREATE INDEX "webhook_endpoints_deleted_idx" ON "webhook_endpoints" USING btree ("deleted_at") WHERE "webhook_endpoints"."deleted_at" is not null;