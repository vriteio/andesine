ALTER TABLE "entry_versions" DROP CONSTRAINT "entry_versions_schema_revision_id_effective_schema_revisions_id_fk";
--> statement-breakpoint
ALTER TABLE "entry_versions" ADD CONSTRAINT "entry_versions_workspace_schema_revision_fk" FOREIGN KEY ("workspace_id","schema_revision_id") REFERENCES "public"."effective_schema_revisions"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_versions_workspace_schema_revision_idx" ON "entry_versions" USING btree ("workspace_id","schema_revision_id");
