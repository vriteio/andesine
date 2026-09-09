CREATE TYPE "public"."asset_analysis_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "asset_analyses" (
	"asset_id" uuid PRIMARY KEY NOT NULL,
	"status" "asset_analysis_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"extracted_text" text,
	"analysis_model" text,
	"embedding" jsonb,
	"embedding_model" text,
	"embedding_dimensions" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_analyses_attempts_valid" CHECK ("asset_analyses"."attempts" >= 0),
	CONSTRAINT "asset_analyses_ready_fields" CHECK ("asset_analyses"."status" <> 'ready' or (
    "asset_analyses"."description" is not null and "asset_analyses"."extracted_text" is not null
    and "asset_analyses"."analysis_model" is not null and "asset_analyses"."embedding" is not null
    and "asset_analyses"."embedding_model" is not null and "asset_analyses"."embedding_dimensions" is not null
    and "asset_analyses"."embedding_dimensions" > 0
    and jsonb_array_length("asset_analyses"."embedding") = "asset_analyses"."embedding_dimensions"
  ))
);
--> statement-breakpoint
ALTER TABLE "asset_analyses" ADD CONSTRAINT "asset_analyses_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_analyses_pending_idx" ON "asset_analyses" USING btree ("next_attempt_at") WHERE "asset_analyses"."status" in ('pending', 'processing');
--> statement-breakpoint
-- Analyze existing entry images, including images kept by saved versions.
-- Profile uploads have no entry binding and are excluded.
INSERT INTO "asset_analyses" ("asset_id")
SELECT "assets"."id" FROM "assets"
INNER JOIN "workspaces" ON "workspaces"."id" = "assets"."workspace_id"
WHERE "assets"."status" = 'ready' AND "workspaces"."deleting_at" IS NULL
AND (
  EXISTS (SELECT 1 FROM "entry_assets" WHERE "entry_assets"."asset_id" = "assets"."id")
  OR EXISTS (SELECT 1 FROM "entry_version_assets" WHERE "entry_version_assets"."asset_id" = "assets"."id")
  OR EXISTS (SELECT 1 FROM "asset_uploads" WHERE "asset_uploads"."asset_id" = "assets"."id"
    AND "asset_uploads"."entry_id" IS NOT NULL AND "asset_uploads"."expires_at" > now())
)
ON CONFLICT ("asset_id") DO NOTHING;
