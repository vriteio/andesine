CREATE TYPE "public"."publishing_snapshot_reason" AS ENUM('initial', 'publish', 'unpublish', 'channel-deletion');--> statement-breakpoint
CREATE TABLE "publishing_snapshot_collections" (
	"workspace_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"rank" varchar(255) NOT NULL,
	"published_root" boolean DEFAULT false NOT NULL,
	CONSTRAINT "publishing_snapshot_collections_snapshot_id_collection_id_pk" PRIMARY KEY("snapshot_id","collection_id"),
	CONSTRAINT "publishing_snapshot_collections_not_own_parent" CHECK ("publishing_snapshot_collections"."collection_id" <> "publishing_snapshot_collections"."parent_id")
);
--> statement-breakpoint
CREATE TABLE "publishing_snapshot_entries" (
	"workspace_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"collection_id" uuid,
	"rank" varchar(255) NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"publisher_id" uuid,
	CONSTRAINT "publishing_snapshot_entries_snapshot_id_entry_id_pk" PRIMARY KEY("snapshot_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "publishing_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"creator_id" uuid,
	"reason" "publishing_snapshot_reason" NOT NULL,
	"superseded_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishing_snapshots_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "publishing_snapshots_workspace_channel_id_unique" UNIQUE("workspace_id","channel_id","id"),
	CONSTRAINT "publishing_snapshots_lifetime_valid" CHECK ((
        "publishing_snapshots"."superseded_at" is null and "publishing_snapshots"."expires_at" is null
      ) or (
        "publishing_snapshots"."superseded_at" is not null and "publishing_snapshots"."expires_at" is not null
        and "publishing_snapshots"."expires_at" >= "publishing_snapshots"."superseded_at"
      ))
);
--> statement-breakpoint
ALTER TABLE "publishing_channels" DROP CONSTRAINT "publishing_channels_workspace_code_unique";--> statement-breakpoint
ALTER TABLE "publishing_channels" ADD COLUMN "current_snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "publishing_channels" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publishing_snapshot_collections" ADD CONSTRAINT "publishing_snapshot_collections_workspace_snapshot_fk" FOREIGN KEY ("workspace_id","snapshot_id") REFERENCES "public"."publishing_snapshots"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshot_collections" ADD CONSTRAINT "publishing_snapshot_collections_workspace_collection_fk" FOREIGN KEY ("workspace_id","collection_id") REFERENCES "public"."collections"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshot_collections" ADD CONSTRAINT "publishing_snapshot_collections_parent_fk" FOREIGN KEY ("snapshot_id","parent_id") REFERENCES "public"."publishing_snapshot_collections"("snapshot_id","collection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshot_entries" ADD CONSTRAINT "publishing_snapshot_entries_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshot_entries" ADD CONSTRAINT "publishing_snapshot_entries_workspace_snapshot_fk" FOREIGN KEY ("workspace_id","snapshot_id") REFERENCES "public"."publishing_snapshots"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshot_entries" ADD CONSTRAINT "publishing_snapshot_entries_workspace_entry_fk" FOREIGN KEY ("workspace_id","entry_id") REFERENCES "public"."entries"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshot_entries" ADD CONSTRAINT "publishing_snapshot_entries_workspace_entry_version_fk" FOREIGN KEY ("workspace_id","entry_id","version_id") REFERENCES "public"."entry_versions"("workspace_id","entry_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshot_entries" ADD CONSTRAINT "publishing_snapshot_entries_collection_fk" FOREIGN KEY ("snapshot_id","collection_id") REFERENCES "public"."publishing_snapshot_collections"("snapshot_id","collection_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshots" ADD CONSTRAINT "publishing_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshots" ADD CONSTRAINT "publishing_snapshots_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_snapshots" ADD CONSTRAINT "publishing_snapshots_workspace_channel_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."publishing_channels"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_snapshot_collections_sibling_rank_unique" ON "publishing_snapshot_collections" USING btree ("snapshot_id","parent_id","rank") WHERE "publishing_snapshot_collections"."parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_snapshot_collections_root_rank_unique" ON "publishing_snapshot_collections" USING btree ("snapshot_id","rank") WHERE "publishing_snapshot_collections"."parent_id" is null;--> statement-breakpoint
CREATE INDEX "publishing_snapshot_collections_collection_idx" ON "publishing_snapshot_collections" USING btree ("workspace_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_snapshot_entries_collection_rank_unique" ON "publishing_snapshot_entries" USING btree ("snapshot_id","collection_id","rank") WHERE "publishing_snapshot_entries"."collection_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_snapshot_entries_root_rank_unique" ON "publishing_snapshot_entries" USING btree ("snapshot_id","rank") WHERE "publishing_snapshot_entries"."collection_id" is null;--> statement-breakpoint
CREATE INDEX "publishing_snapshot_entries_entry_idx" ON "publishing_snapshot_entries" USING btree ("workspace_id","entry_id");--> statement-breakpoint
CREATE INDEX "publishing_snapshot_entries_version_idx" ON "publishing_snapshot_entries" USING btree ("workspace_id","version_id");--> statement-breakpoint
CREATE INDEX "publishing_snapshots_workspace_channel_created_idx" ON "publishing_snapshots" USING btree ("workspace_id","channel_id","created_at");--> statement-breakpoint
CREATE INDEX "publishing_snapshots_expiry_idx" ON "publishing_snapshots" USING btree ("expires_at") WHERE "publishing_snapshots"."expires_at" is not null;--> statement-breakpoint
ALTER TABLE "publishing_channels" ADD CONSTRAINT "publishing_channels_current_snapshot_id_publishing_snapshots_id_fk" FOREIGN KEY ("current_snapshot_id") REFERENCES "public"."publishing_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_channels_workspace_code_unique" ON "publishing_channels" USING btree ("workspace_id","code") WHERE "publishing_channels"."deleted_at" is null;