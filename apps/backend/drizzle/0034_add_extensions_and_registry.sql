CREATE TYPE "public"."extension_disabled_reason" AS ENUM('approval_required', 'configuration_required', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."extension_permission" AS ENUM('entries', 'read:entries', 'versions', 'read:versions', 'publishing', 'read:publishing', 'collections', 'read:collections', 'memberships', 'read:memberships', 'roles', 'read:roles', 'webhooks', 'read:webhooks', 'ai-answers', 'read:restricted_collections');--> statement-breakpoint
CREATE TABLE "extension_active_views" (
	"workspace_id" uuid NOT NULL,
	"selector" varchar(100) NOT NULL,
	"extension_id" uuid NOT NULL,
	"view_id" varchar(64) NOT NULL,
	CONSTRAINT "extension_active_views_workspace_id_selector_pk" PRIMARY KEY("workspace_id","selector"),
	CONSTRAINT "extension_active_views_selector_valid" CHECK ("extension_active_views"."selector" = lower("extension_active_views"."selector"))
);
--> statement-breakpoint
CREATE TABLE "extension_configurations" (
	"extension_id" uuid PRIMARY KEY NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_configurations_revision_valid" CHECK ("extension_configurations"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "extension_element_views" (
	"extension_id" uuid NOT NULL,
	"view_id" varchar(64) NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_element_views_extension_id_view_id_pk" PRIMARY KEY("extension_id","view_id")
);
--> statement-breakpoint
CREATE TABLE "extension_registry_keys" (
	"source" varchar(2048) NOT NULL,
	"name" varchar(100) NOT NULL,
	"kid" varchar(64) NOT NULL,
	"key" jsonb,
	"current" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_registry_keys_name_kid_pk" PRIMARY KEY("name","kid"),
	CONSTRAINT "extension_registry_keys_state_valid" CHECK (("extension_registry_keys"."key" is not null or "extension_registry_keys"."revoked_at" is not null) and not ("extension_registry_keys"."current" and "extension_registry_keys"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "extension_registry_versions" (
	"source" varchar(2048) NOT NULL,
	"name" varchar(100) NOT NULL,
	"version" varchar(64) NOT NULL,
	"manifest" jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"replacement_version" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_registry_versions_name_version_pk" PRIMARY KEY("name","version"),
	CONSTRAINT "extension_registry_versions_revocation_valid" CHECK (("extension_registry_versions"."revoked_at" is null) = ("extension_registry_versions"."revocation_reason" is null) and ("extension_registry_versions"."replacement_version" is null or "extension_registry_versions"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "extension_secrets" (
	"extension_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_secrets_extension_id_key_pk" PRIMARY KEY("extension_id","key")
);
--> statement-breakpoint
CREATE TABLE "extension_storage" (
	"extension_id" uuid NOT NULL,
	"key" varchar(256) NOT NULL,
	"value" jsonb NOT NULL,
	"size" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extension_storage_extension_id_key_pk" PRIMARY KEY("extension_id","key"),
	CONSTRAINT "extension_storage_size_valid" CHECK ("extension_storage"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"version" varchar(64) NOT NULL,
	"development" boolean DEFAULT false NOT NULL,
	"permissions" "extension_permission"[] DEFAULT '{}' NOT NULL,
	"backend_url" varchar(2048),
	"requests" text[] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"disabled_reason" "extension_disabled_reason",
	"revision" integer DEFAULT 1 NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"uninstalled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extensions_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "extensions_counters_valid" CHECK ("extensions"."revision" > 0 and "extensions"."generation" > 0),
	CONSTRAINT "extensions_tombstone_valid" CHECK ("extensions"."uninstalled_at" is null or not "extensions"."enabled")
);
--> statement-breakpoint
ALTER TABLE "extension_active_views" ADD CONSTRAINT "extension_active_views_extension_fk" FOREIGN KEY ("workspace_id","extension_id") REFERENCES "public"."extensions"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_active_views" ADD CONSTRAINT "extension_active_views_view_fk" FOREIGN KEY ("extension_id","view_id") REFERENCES "public"."extension_element_views"("extension_id","view_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_configurations" ADD CONSTRAINT "extension_configurations_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_element_views" ADD CONSTRAINT "extension_element_views_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_secrets" ADD CONSTRAINT "extension_secrets_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_storage" ADD CONSTRAINT "extension_storage_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "extensions_workspace_name_unique" ON "extensions" USING btree ("workspace_id","name") WHERE "extensions"."uninstalled_at" is null;--> statement-breakpoint
CREATE INDEX "extensions_version_idx" ON "extensions" USING btree ("name","version");