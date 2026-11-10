CREATE TABLE "asset_storage_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_storage_deletions_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
CREATE TABLE "asset_uploads" (
	"asset_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"byte_size" integer NOT NULL,
	"expected_checksum" varchar(64) NOT NULL,
	"reserved_bytes" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_uploads_size_positive" CHECK ("asset_uploads"."byte_size" > 0 and "asset_uploads"."reserved_bytes" >= 0),
	CONSTRAINT "asset_uploads_checksum_valid" CHECK ("asset_uploads"."expected_checksum" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "asset_uploads" ADD CONSTRAINT "asset_uploads_workspace_asset_fk" FOREIGN KEY ("workspace_id","asset_id") REFERENCES "public"."assets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_uploads" ADD CONSTRAINT "asset_uploads_workspace_entry_fk" FOREIGN KEY ("workspace_id","entry_id") REFERENCES "public"."entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_uploads_workspace_idx" ON "asset_uploads" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "asset_uploads_expiry_idx" ON "asset_uploads" USING btree ("expires_at");