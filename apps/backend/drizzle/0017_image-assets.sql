CREATE TYPE "public"."asset_file_format" AS ENUM('jpeg', 'png', 'webp');--> statement-breakpoint
CREATE TYPE "public"."asset_file_variant" AS ENUM('source', 'thumbnail', 'display');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'deleting');--> statement-breakpoint
CREATE TABLE "asset_files" (
	"asset_id" uuid NOT NULL,
	"variant" "asset_file_variant" NOT NULL,
	"object_key" text NOT NULL,
	"format" "asset_file_format" NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_files_asset_id_variant_pk" PRIMARY KEY("asset_id","variant"),
	CONSTRAINT "asset_files_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "asset_files_object_key_not_empty" CHECK (length(trim("asset_files"."object_key")) > 0),
	CONSTRAINT "asset_files_byte_size_positive" CHECK ("asset_files"."byte_size" > 0),
	CONSTRAINT "asset_files_dimensions_positive" CHECK ("asset_files"."width" > 0 and "asset_files"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"user_id" uuid,
	"filename" varchar(255) NOT NULL,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"source_checksum" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "assets_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "assets_single_owner" CHECK (("assets"."workspace_id" is not null) <> ("assets"."user_id" is not null)),
	CONSTRAINT "assets_filename_not_empty" CHECK (length(trim("assets"."filename")) > 0),
	CONSTRAINT "assets_source_checksum_valid" CHECK ("assets"."source_checksum" is null or "assets"."source_checksum" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "assets_ready_checksum_required" CHECK ("assets"."status" <> 'ready' or "assets"."source_checksum" is not null)
);
--> statement-breakpoint
CREATE TABLE "entry_assets" (
	"workspace_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	CONSTRAINT "entry_assets_entry_id_asset_id_pk" PRIMARY KEY("entry_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "entry_version_assets" (
	"workspace_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	CONSTRAINT "entry_version_assets_version_id_asset_id_pk" PRIMARY KEY("version_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "asset_files" ADD CONSTRAINT "asset_files_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_assets" ADD CONSTRAINT "entry_assets_workspace_entry_fk" FOREIGN KEY ("workspace_id","entry_id") REFERENCES "public"."entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_assets" ADD CONSTRAINT "entry_assets_workspace_asset_fk" FOREIGN KEY ("workspace_id","asset_id") REFERENCES "public"."assets"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_version_assets" ADD CONSTRAINT "entry_version_assets_workspace_entry_version_fk" FOREIGN KEY ("workspace_id","entry_id","version_id") REFERENCES "public"."entry_versions"("workspace_id","entry_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_version_assets" ADD CONSTRAINT "entry_version_assets_workspace_asset_fk" FOREIGN KEY ("workspace_id","asset_id") REFERENCES "public"."assets"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_workspace_checksum_idx" ON "assets" USING btree ("workspace_id","source_checksum") WHERE "assets"."source_checksum" is not null;--> statement-breakpoint
CREATE INDEX "assets_status_updated_idx" ON "assets" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "entry_assets_workspace_asset_idx" ON "entry_assets" USING btree ("workspace_id","asset_id");--> statement-breakpoint
CREATE INDEX "entry_version_assets_workspace_asset_idx" ON "entry_version_assets" USING btree ("workspace_id","asset_id");--> statement-breakpoint
CREATE INDEX "entry_version_assets_workspace_entry_idx" ON "entry_version_assets" USING btree ("workspace_id","entry_id");