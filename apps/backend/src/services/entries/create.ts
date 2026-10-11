import { createContentState } from "#backend/collaboration";
import {
  collections,
  contents,
  effectiveSchemaRevisions,
  entries,
  type DatabaseTransaction as Database
} from "@andesine/server/database";
import {
  assertContentNameAvailable,
  getAvailableContentName,
  loadCurrentContentPaths
} from "@andesine/server/content";
import { getResolvedSchemaDefinition, migrateSchemaContentState } from "@andesine/server/schema";
import {
  createOutboundEvent,
  createWebhookOperation,
  createWebhookRecorder,
  getWebhookEntryContext
} from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import { syncEntryAssets } from "@andesine/server/assets";
import { Asset } from "#backend/services/assets";
import {
  applyContentOperations,
  decodeEntryMDX,
  prepareEntryContent,
  resolveCollectionTarget,
  setContentTitle
} from "#backend/lib/content";
import { getContentTitle, type ContentNode } from "@andesine/document";
import {
  rankBetweenNeighbors,
  toCollectionID,
  toEntryID,
  toUUID,
  toWorkspaceID
} from "@andesine/contracts/primitives";
import { type Entry } from "@andesine/contracts/entities";
import { and, desc, eq, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import {
  invalidPath,
  normalizeCollectionName,
  normalizeEntryName,
  parseContentPath
} from "@andesine/contracts/content";
import {
  withAuthorization,
  type AuthorizationScope,
  type AuthorizedCollectionTree,
  type SessionData
} from "#backend/lib/policy";
import { Collections } from "#backend/services/collections";
import type { PublishingEntryStatus } from "#backend/lib/publishing";

interface CreateEntryInput extends Partial<Entry> {
  document?: ContentNode;
  mdx?: string;
  fields?: Record<string, unknown>;
  path?: string;
  collectionPath?: string;
  collectionSlugPath?: string;
}
interface CreateEntryResult {
  entry: Entry & { path: string; slugPath: string };
  createdCollections: CreatedCollection[];
  publishingEntries: PublishingEntryStatus[];
}
interface EnsureEntryPathInput {
  auth: SessionData;
  authorization: AuthorizedCollectionTree;
  authorizationScope: AuthorizationScope;
  database: Database;
  workspaceID: string;
  path: string;
}
interface EntryPathTarget {
  collectionID: string | null;
  name: string;
  createdCollections: CreatedCollection[];
}

interface ResolvedCreateEntry {
  collectionID: string | null;
}

type CreatedCollection = Awaited<ReturnType<typeof Collections.create>>;

const createInitialDocument = (name: string): ContentNode => ({
  type: "doc",
  content: [
    {
      type: "title",
      ...(name ? { content: [{ type: "text", text: name }] } : {})
    },
    { type: "paragraph" }
  ]
});

/**
 * Finds the collections of an entry path, and creates the missing ones with exact names. New
 * collections inherit access, so the deepest existing collection must allow the entry.
 */
const ensureEntryPath = async ({
  auth,
  authorization,
  authorizationScope,
  database,
  workspaceID,
  path
}: EnsureEntryPathInput): Promise<EntryPathTarget> => {
  const { anchorID, segments } = parseContentPath(path);
  const name = segments.pop();
  const createdCollections: CreatedCollection[] = [];
  const [root] = await database
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.workspaceID, workspaceID),
        isNull(collections.parentID),
        isNull(collections.deletedAt)
      )
    );

  let collectionID = anchorID === root?.id ? null : anchorID;

  if (!name) throw invalidPath();

  for (const segment of segments) {
    const collectionName = normalizeCollectionName(segment);
    const [existing] = await database
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.workspaceID, workspaceID),
          eq(collections.parentID, collectionID ?? root!.id),
          eq(collections.name, collectionName),
          isNull(collections.deletedAt)
        )
      );

    if (existing) {
      collectionID = existing.id;
      continue;
    }

    const newCollectionID = crypto.randomUUID();
    const parentID = collectionID ? toCollectionID(collectionID) : undefined;

    if (!createdCollections.length) {
      authorization.assertEntryAction(collectionID, "entry:create");
      authorization.assertCollectionAction(collectionID, "collection:create-child");
    }

    // A sibling entry with the same name is a conflict, not a suffixed collection name.
    await assertContentNameAvailable(database, workspaceID, {
      kind: "collection",
      id: newCollectionID,
      parentID: collectionID ?? root!.id,
      name: collectionName
    });

    const created = await Collections.create({
      auth,
      id: toCollectionID(newCollectionID),
      name: collectionName,
      parentID,
      skipAuthorization: authorizationScope
    });

    createdCollections.push(created);
    collectionID = newCollectionID;
  }

  if (!createdCollections.length) authorization.assertEntryAction(collectionID, "entry:create");

  return { collectionID, name: normalizeEntryName(name), createdCollections };
};
const createEntry = withAuthorization<CreateEntryInput, ResolvedCreateEntry, CreateEntryResult>(
  {
    // A path is authorized when it is resolved.
    actions: ({ input, resolved }) => ({
      entries:
        input.path === undefined
          ? [{ action: "entry:create", collectionID: resolved.collectionID }]
          : []
    }),
    resolve: async ({ database, input, workspaceID }) => ({
      collectionID: (await resolveCollectionTarget(database, workspaceID, input)) ?? null
    }),
    transaction: "locked-workspace",
    tree: true
  },
  async ({ auth, authorization, authorizationScope, database, input, resolved, workspaceID }) => {
    const entryID = input.id ? toUUID(input.id) : crypto.randomUUID();
    const pathTarget =
      input.path === undefined
        ? null
        : await ensureEntryPath({
            auth,
            authorization,
            authorizationScope,
            database,
            workspaceID,
            path: input.path
          });
    const collectionID = pathTarget ? pathTarget.collectionID : resolved.collectionID;
    const operation = createWebhookOperation(toWorkspaceID(workspaceID));
    const recorder = await createWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database,
      operation
    });
    const [activeRevision] = collectionID
      ? await database
          .select({
            definition: effectiveSchemaRevisions.definition,
            id: effectiveSchemaRevisions.id
          })
          .from(effectiveSchemaRevisions)
          .where(
            and(
              eq(effectiveSchemaRevisions.workspaceID, workspaceID),
              eq(effectiveSchemaRevisions.collectionID, collectionID),
              eq(effectiveSchemaRevisions.active, true)
            )
          )
          .limit(1)
      : [];
    const createSchemaContent = (title: string) => {
      if (!activeRevision) return null;

      return migrateSchemaContentState({
        defaultMode: "new-entry",
        document: createInitialDocument(title),
        schema: getResolvedSchemaDefinition(activeRevision.definition),
        state: null
      });
    };
    // MDX fields are restored from the initial schema content.
    const suppliedDocument =
      input.mdx === undefined
        ? input.document
        : await decodeEntryMDX(
            input.mdx,
            createSchemaContent("")?.document ?? createInitialDocument("")
          );
    const name = pathTarget
      ? pathTarget.name
      : await getAvailableContentName(database, workspaceID, {
          kind: "entry",
          id: entryID,
          parentID: collectionID,
          name: normalizeEntryName(
            (suppliedDocument ? getContentTitle(suppliedDocument) : input.name) || "Untitled"
          )
        });

    // A path names the entry exactly, so a name already used there is a conflict.
    if (pathTarget) {
      await assertContentNameAvailable(database, workspaceID, {
        kind: "entry",
        id: entryID,
        parentID: collectionID,
        name
      });
    }

    const entry = await (async () => {
      if (collectionID) {
        const [parent] = await database
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.id, collectionID),
              eq(collections.workspaceID, workspaceID),
              isNull(collections.deletedAt)
            )
          )
          .for("update");

        if (!parent) throw new ORPCError("BAD_REQUEST", { message: "Collection not found" });
      }

      const siblingFilter = collectionID
        ? and(
            eq(entries.workspaceID, workspaceID),
            eq(entries.collectionID, collectionID),
            isNull(entries.deletedAt)
          )
        : and(
            eq(entries.workspaceID, workspaceID),
            isNull(entries.collectionID),
            isNull(entries.deletedAt)
          );
      const [last] = await database
        .select({ rank: entries.rank })
        .from(entries)
        .where(siblingFilter)
        .orderBy(desc(entries.rank))
        .limit(1);
      const rank = rankBetweenNeighbors(last?.rank);

      const [inserted] = await database
        .insert(entries)
        .values({
          id: entryID,
          workspaceID,
          collectionID,
          name,
          rank
        })
        .onConflictDoNothing({ target: entries.id })
        .returning({ id: entries.id });
      const [created] = await database
        .select()
        .from(entries)
        .where(
          and(
            eq(entries.id, entryID),
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt)
          )
        );

      if (!created) {
        throw new ORPCError("BAD_REQUEST", { message: "Entry ID belongs to another workspace" });
      }

      // An existing entry with this ID keeps its content.
      if (inserted) {
        const fieldOperations = Object.entries(input.fields ?? {}).map(([key, value]) => ({
          type: "setField" as const,
          key,
          value
        }));
        const initialDocument = suppliedDocument
          ? setContentTitle(suppliedDocument, created.name)
          : fieldOperations.length
            ? (createSchemaContent(created.name)?.document ?? createInitialDocument(created.name))
            : null;
        const initialContent = initialDocument
          ? await prepareEntryContent(database, workspaceID, {
              authorization,
              entryID: created.id,
              schemaRevisionID: activeRevision?.id ?? null,
              document: await applyContentOperations(initialDocument, fieldOperations)
            })
          : // Without content, store what a live document starts with, so reads and writes agree.
            (createSchemaContent(created.name) ??
            createContentState(createInitialDocument(created.name)));

        if (initialDocument) {
          await Asset.grantContent({
            auth,
            entryID: toEntryID(created.id),
            document: initialContent.document,
            skipAuthorization: authorizationScope
          });
        }

        await database
          .insert(contents)
          .values({
            entryID: created.id,
            workspaceID: created.workspaceID,
            ...(initialContent && {
              document: initialContent.document,
              hash: initialContent.hash,
              schemaRevisionID: activeRevision?.id ?? null,
              state: initialContent.state
            })
          })
          .onConflictDoNothing({ target: contents.entryID });

        // No collaboration save follows, so confirm the image grants here.
        if (initialDocument) {
          await syncEntryAssets({
            database,
            workspaceID,
            entryID: created.id,
            document: initialContent.document
          });
        }

        const context = getWebhookEntryContext(recorder.before, created);

        await recorder.record([
          {
            event: createOutboundEvent(operation, "created", {
              type: "entry.created",
              subject: context.subject,
              data: {
                name: created.name,
                collectionID: context.collectionID,
                ...(initialContent && { contentHash: initialContent.hash })
              }
            }),
            resources: [{ ...context.subject, before: null, after: context.scope }]
          }
        ]);
      }

      return created;
    })();

    const paths = await loadCurrentContentPaths(database, workspaceID);
    const mappedEntry = {
      id: toEntryID(entry.id),
      name: entry.name,
      path: paths.entryPath(entry.collectionID, entry.name),
      slugPath: paths.entrySlugPath(entry.collectionID, entry.name, entry.id),
      order: entry.rank,
      collectionID: entry.collectionID ? toCollectionID(entry.collectionID) : undefined
    };

    return {
      entry: mappedEntry,
      createdCollections: pathTarget?.createdCollections ?? [],
      publishingEntries: [
        {
          entryID: mappedEntry.id,
          hasUnpublishedChanges: authorization.isPublishingEnabled(entry.collectionID),
          versionID: null
        }
      ]
    };
  }
);

export { createEntry };
