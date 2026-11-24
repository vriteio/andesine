ALTER TYPE "public"."key_permission" ADD VALUE 'read:restricted_collections';--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "restricted_collection_ids" uuid[] DEFAULT '{}' NOT NULL;