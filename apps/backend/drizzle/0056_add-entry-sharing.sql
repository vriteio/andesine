CREATE TYPE "public"."share_access" AS ENUM('view', 'comment');--> statement-breakpoint
CREATE TYPE "public"."share_kind" AS ENUM('link', 'email');--> statement-breakpoint
ALTER TYPE "public"."key_permission" ADD VALUE 'sharing' BEFORE 'versions';--> statement-breakpoint
ALTER TYPE "public"."permission" RENAME TO "permission_old";--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('content', 'comments', 'sharing', 'publishing', 'api_keys', 'read:api_keys', 'billing', 'read:billing', 'restricted_collections', 'read:restricted_collections', 'memberships', 'roles', 'webhooks', 'read:webhooks', 'extensions', 'workspace');--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "permissions" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "permissions" SET DATA TYPE "public"."permission"[] USING "permissions"::text[]::"public"."permission"[];--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "permissions" SET DEFAULT '{}'::"public"."permission"[];--> statement-breakpoint
DROP TYPE "public"."permission_old";--> statement-breakpoint
UPDATE "roles"
SET "permissions" = array_append("permissions", 'sharing'::"public"."permission")
WHERE 'content'::"public"."permission" = ANY("permissions");--> statement-breakpoint
CREATE TABLE "entry_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"kind" "share_kind" NOT NULL,
	"access" "share_access" NOT NULL,
	"token" text,
	"email" varchar(320),
	"created_by_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_shares_token_unique" UNIQUE("token"),
	CONSTRAINT "entry_shares_workspace_id_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "visitor_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"share_id" uuid,
	"user_id" uuid,
	"name" varchar(50),
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitors_workspace_id_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "comment_threads" ADD COLUMN "visitor_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "visitor_id" uuid;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "link_sharing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "email_sharing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "max_share_expiry_days" integer;--> statement-breakpoint
ALTER TABLE "entry_shares" ADD CONSTRAINT "entry_shares_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_shares" ADD CONSTRAINT "entry_shares_created_by_id_memberships_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_shares" ADD CONSTRAINT "entry_shares_workspace_entry_fk" FOREIGN KEY ("workspace_id","entry_id") REFERENCES "public"."entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_tokens" ADD CONSTRAINT "visitor_tokens_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_share_id_entry_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."entry_shares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_shares_created_by_id_idx" ON "entry_shares" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_shares_link_unique" ON "entry_shares" USING btree ("entry_id") WHERE "entry_shares"."kind" = 'link';--> statement-breakpoint
CREATE UNIQUE INDEX "entry_shares_email_unique" ON "entry_shares" USING btree ("entry_id","email") WHERE "entry_shares"."kind" = 'email';--> statement-breakpoint
CREATE INDEX "visitor_tokens_visitor_id_idx" ON "visitor_tokens" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "visitors_share_id_idx" ON "visitors" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "visitors_user_id_idx" ON "visitors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visitors_share_user_unique" ON "visitors" USING btree ("share_id","user_id") WHERE "visitors"."user_id" is not null;--> statement-breakpoint
ALTER TABLE "comment_threads" ADD CONSTRAINT "comment_threads_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_threads_visitor_id_idx" ON "comment_threads" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "comments_visitor_id_idx" ON "comments" USING btree ("visitor_id");