CREATE TYPE "public"."key_kind" AS ENUM('secret', 'publishable');--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "kind" "key_kind" DEFAULT 'secret' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "collection_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "allowed_origins" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "encrypted_value" text;