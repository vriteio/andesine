import { memberships, workspaces } from "@andesine/server/database";
import { PUBLISHED_CHANNEL_CODE } from "@andesine/contracts/publishing";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { enqueueCurrentEntrySync, enqueuePublishedEntrySync } from "#backend/lib/queue";
import { config } from "#backend/lib/config";
import { resolveUserAuthorization } from "#backend/lib/auth/user-authorization";
import {
  EXAMPLE_COLLECTION_NAME,
  createExampleEntries,
  createExampleSchema
} from "#backend/lib/onboarding";
import { getUserAuthorization, type SessionData } from "#backend/lib/policy";
import { Collections } from "#backend/services/collections";
import { Entries } from "#backend/services/entries";
import { Publishing } from "#backend/services/publishing";
import { Schema } from "#backend/services/schemas";
import { count, eq } from "drizzle-orm";

interface SeedExampleContentInput {
  workspaceID: string;
  userID: string;
}

const MIGRATION_TIMEOUT_MS = 20_000;
const MIGRATION_POLL_MS = 250;

/** Entries can't be created while the worker migrates the collection to the schema. */
const applyExampleSchema = async (auth: SessionData, collectionID: string): Promise<void> => {
  const { schema } = await Schema.create({
    auth,
    collectionID,
    definition: createExampleSchema()
  });
  const { migrationID } = await Schema.Migrations.apply({
    auth,
    schemaID: schema.id,
    confirmedDataLoss: true
  });
  const deadline = Date.now() + MIGRATION_TIMEOUT_MS;

  while (migrationID) {
    const { status } = await Schema.Migrations.get({ auth, migrationID });

    const stopped = status === "failed" || Date.now() > deadline;

    if (status === "completed") return;
    if (stopped) {
      throw new Error(`Example schema migration didn't complete (${status})`);
    }

    await new Promise((resolve) => setTimeout(resolve, MIGRATION_POLL_MS));
  }
};

/** Adds the example content to the user's first workspace (every workspace outside production). */
const seedExampleContent = async (input: SeedExampleContentInput): Promise<void> => {
  const [{ value: membershipCount }] = await db
    .select({ value: count() })
    .from(memberships)
    .where(eq(memberships.userID, toUUID(input.userID)));

  const firstWorkspace = membershipCount === 1;
  const development = config.NODE_ENV !== "production";

  if (!firstWorkspace && !development) return;

  const auth = await resolveUserAuthorization({
    userID: input.userID,
    type: "session",
    headers: new Headers({ "x-workspace-id": input.workspaceID })
  });
  const contributorIDs = [getUserAuthorization(auth)!.memberID];
  const collection = await Collections.create({ auth, name: EXAMPLE_COLLECTION_NAME });

  await Publishing.Collections.set({
    auth,
    collectionIDs: [collection.id],
    enabled: true,
    publish: false,
    contributorIDs
  });
  await applyExampleSchema(auth, collection.id);

  const entryIDs: string[] = [];
  const publishingEntryIDs: string[] = [];

  // New entries go first, so the guide is created in reverse.
  for (const exampleEntry of createExampleEntries(config.PUBLIC_API_URL).reverse()) {
    const { entry } = await Entries.create({
      auth,
      collectionID: collection.id,
      mdx: exampleEntry.mdx
    });

    entryIDs.push(entry.id);

    if (exampleEntry.published) publishingEntryIDs.push(entry.id);
  }

  const { snapshot } = await Publishing.Entries.publish({
    auth,
    entries: publishingEntryIDs.map((entryID) => ({ entryID })),
    channel: PUBLISHED_CHANNEL_CODE,
    contributorIDs
  });

  await db
    .update(workspaces)
    .set({ exampleCollectionID: toUUID(collection.id) })
    .where(eq(workspaces.id, toUUID(input.workspaceID)));

  await enqueueCurrentEntrySync({ workspaceID: input.workspaceID, entryIDs });
  await enqueuePublishedEntrySync({
    workspaceID: input.workspaceID,
    entryIDs: snapshot?.searchSyncEntryIDs ?? []
  });
};

export { seedExampleContent };
