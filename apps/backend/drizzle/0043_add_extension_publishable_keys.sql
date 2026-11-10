ALTER TYPE "public"."extension_permission" ADD VALUE 'publishable-keys';--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "extension_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_extension_id_idx" ON "api_keys" USING btree ("extension_id");