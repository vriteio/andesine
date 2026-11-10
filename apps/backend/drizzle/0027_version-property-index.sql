CREATE TABLE "entry_version_properties" (
	"workspace_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"text_value" text[],
	"number_value" double precision,
	"boolean_value" boolean,
	"date_value" bigint,
	CONSTRAINT "entry_version_properties_workspace_id_version_id_key_pk" PRIMARY KEY("workspace_id","version_id","key"),
	CONSTRAINT "entry_version_properties_value_kind_check" CHECK (
    ("entry_version_properties"."kind" = 'text' AND "entry_version_properties"."text_value" IS NOT NULL AND "entry_version_properties"."number_value" IS NULL AND "entry_version_properties"."boolean_value" IS NULL AND "entry_version_properties"."date_value" IS NULL) OR
    ("entry_version_properties"."kind" = 'number' AND "entry_version_properties"."text_value" IS NULL AND "entry_version_properties"."boolean_value" IS NULL AND "entry_version_properties"."date_value" IS NULL) OR
    ("entry_version_properties"."kind" = 'boolean' AND "entry_version_properties"."boolean_value" IS NOT NULL AND "entry_version_properties"."text_value" IS NULL AND "entry_version_properties"."number_value" IS NULL AND "entry_version_properties"."date_value" IS NULL) OR
    ("entry_version_properties"."kind" = 'date' AND "entry_version_properties"."text_value" IS NULL AND "entry_version_properties"."number_value" IS NULL AND "entry_version_properties"."boolean_value" IS NULL)
  ),
	CONSTRAINT "entry_version_properties_finite_number_check" CHECK ("entry_version_properties"."number_value" > '-Infinity'::float8 AND "entry_version_properties"."number_value" < 'Infinity'::float8)
);
--> statement-breakpoint
ALTER TABLE "entry_version_properties" ADD CONSTRAINT "entry_version_properties_workspace_version_fk" FOREIGN KEY ("workspace_id","version_id") REFERENCES "public"."entry_versions"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_version_properties_lookup_idx" ON "entry_version_properties" USING btree ("workspace_id","key","kind","version_id");--> statement-breakpoint
CREATE INDEX "entry_version_properties_number_idx" ON "entry_version_properties" USING btree ("workspace_id","key","number_value","version_id") WHERE "entry_version_properties"."kind" = 'number' AND "entry_version_properties"."number_value" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "entry_version_properties_boolean_idx" ON "entry_version_properties" USING btree ("workspace_id","key","boolean_value","version_id") WHERE "entry_version_properties"."kind" = 'boolean';--> statement-breakpoint
CREATE INDEX "entry_version_properties_date_idx" ON "entry_version_properties" USING btree ("workspace_id","key","date_value","version_id") WHERE "entry_version_properties"."kind" = 'date' AND "entry_version_properties"."date_value" IS NOT NULL;