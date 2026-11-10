ALTER TYPE "public"."permission" ADD VALUE 'memberships' BEFORE 'workspace';--> statement-breakpoint
ALTER TYPE "public"."permission" ADD VALUE 'roles' BEFORE 'workspace';--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_workspace_member_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "member_id";