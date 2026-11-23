ALTER TYPE "public"."permission" ADD VALUE 'comments' BEFORE 'publishing';--> statement-breakpoint
CREATE TABLE "comment_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"block_id" text,
	"anchor_start" text,
	"anchor_end" text,
	"quote" text,
	"author_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_threads_workspace_id_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"mention_ids" uuid[] DEFAULT '{}' NOT NULL,
	"suggestion" text,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_threads" ADD CONSTRAINT "comment_threads_workspace_entry_fk" FOREIGN KEY ("workspace_id","entry_id") REFERENCES "public"."entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_threads" ADD CONSTRAINT "comment_threads_author_fk" FOREIGN KEY ("author_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_threads" ADD CONSTRAINT "comment_threads_resolved_by_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_thread_fk" FOREIGN KEY ("workspace_id","thread_id") REFERENCES "public"."comment_threads"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_fk" FOREIGN KEY ("author_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_threads_workspace_entry_idx" ON "comment_threads" USING btree ("workspace_id","entry_id");--> statement-breakpoint
CREATE INDEX "comments_workspace_thread_idx" ON "comments" USING btree ("workspace_id","thread_id");