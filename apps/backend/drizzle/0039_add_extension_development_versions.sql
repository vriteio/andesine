CREATE TABLE "extension_development_versions" (
	"extension_id" uuid PRIMARY KEY NOT NULL,
	"version" varchar(64) NOT NULL,
	"manifest" jsonb NOT NULL,
	"frontend" text NOT NULL,
	"styles" text,
	"icons" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extensions" ADD COLUMN "developer_id" uuid;--> statement-breakpoint
ALTER TABLE "extension_development_versions" ADD CONSTRAINT "extension_development_versions_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_developer_fk" FOREIGN KEY ("workspace_id","developer_id") REFERENCES "public"."memberships"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_development_valid" CHECK ("extensions"."development" = ("extensions"."developer_id" is not null));