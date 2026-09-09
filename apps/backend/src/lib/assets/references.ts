import { assetUploads, assets, entryAssets, entryVersionAssets } from "#backend/db";
import type { ContentNode } from "#backend/lib/content";
import type { db } from "#backend/lib/adapters/postgres";
import { ORPCError } from "@orpc/server";
import { publicID, toUUID } from "#backend/lib/primitives";
import { and, eq, gt, inArray, isNotNull, isNull, or, exists } from "drizzle-orm";

interface RetainVersionAssetsInput {
  database: Database;
  workspaceID: string;
  entryID: string;
  versionID: string;
  sourceVersionID?: string;
  document: ContentNode;
}

interface SyncEntryAssetsInput {
  database: Database;
  workspaceID: string;
  entryID: string;
  document: ContentNode;
  recoveryDocument?: ContentNode;
  restoreUntil?: Date;
}

type Database = Parameters<Parameters<typeof db.transaction>[0]>[0];

const assetIDType = publicID("ast");
const parseAssetID = (value: unknown): string | null => {
  if (!assetIDType.safeParse(value).success) return null;

  try {
    return toUUID(String(value));
  } catch {
    return null;
  }
};
const getContentAssetIDs = (document: ContentNode): string[] => {
  const ids = new Set<string>();
  const visit = (node: ContentNode) => {
    const assetID = node.type === "image" ? parseAssetID(node.attrs?.assetID) : null;

    if (assetID) ids.add(assetID);
    node.content?.forEach(visit);
  };

  visit(document);
  return [...ids];
};
// The caller must hold the workspace lock. A snapshot cannot grant access to an image.
const retainVersionAssets = async ({
  database,
  workspaceID,
  entryID,
  versionID,
  sourceVersionID,
  document
}: RetainVersionAssetsInput): Promise<void> => {
  const requestedIDs = getContentAssetIDs(document);

  if (!requestedIDs.length) return;

  const available = await database
    .select({ id: assets.id })
    .from(assets)
    .where(
      and(
        eq(assets.workspaceID, workspaceID),
        eq(assets.status, "ready"),
        inArray(assets.id, requestedIDs),
        or(
          exists(
            database
              .select({ assetID: entryAssets.assetID })
              .from(entryAssets)
              .where(
                and(
                  eq(entryAssets.assetID, assets.id),
                  eq(entryAssets.entryID, entryID),
                  or(isNull(entryAssets.pendingUntil), gt(entryAssets.pendingUntil, new Date()))
                )
              )
          ),
          exists(
            database
              .select({ assetID: assetUploads.assetID })
              .from(assetUploads)
              .where(
                and(
                  eq(assetUploads.assetID, assets.id),
                  eq(assetUploads.entryID, entryID),
                  gt(assetUploads.expiresAt, new Date())
                )
              )
          ),
          exists(
            database
              .select({ assetID: entryVersionAssets.assetID })
              .from(entryVersionAssets)
              .where(
                and(
                  eq(entryVersionAssets.assetID, assets.id),
                  eq(entryVersionAssets.entryID, entryID),
                  inArray(
                    entryVersionAssets.versionID,
                    sourceVersionID ? [versionID, sourceVersionID] : [versionID]
                  )
                )
              )
          )
        )
      )
    )
    .for("key share");

  if (available.length !== requestedIDs.length) {
    throw new ORPCError("CONFLICT", {
      message: "Version contains an unavailable or unauthorized image"
    });
  }

  await database
    .update(assets)
    .set({ unreferencedAt: null })
    .where(and(inArray(assets.id, requestedIDs), isNotNull(assets.unreferencedAt)));
  await database
    .insert(entryVersionAssets)
    .values(
      available.map(({ id: assetID }) => ({
        workspaceID,
        entryID,
        versionID,
        assetID
      }))
    )
    .onConflictDoNothing();
};
// Call in the content transaction, with the workspace and entry locked. Never infer a
// grant from a client-supplied asset ID or from the last contributor to a shared document.
const syncEntryAssets = async ({
  database,
  workspaceID,
  entryID,
  document,
  recoveryDocument,
  restoreUntil
}: SyncEntryAssetsInput) => {
  const now = new Date();
  const requestedIDs = getContentAssetIDs(document);
  const scope = and(eq(entryAssets.workspaceID, workspaceID), eq(entryAssets.entryID, entryID));
  const current = await database.select().from(entryAssets).where(scope);
  const uploads = requestedIDs.length
    ? await database
        .select({ assetID: assetUploads.assetID })
        .from(assetUploads)
        .where(
          and(
            eq(assetUploads.workspaceID, workspaceID),
            eq(assetUploads.entryID, entryID),
            gt(assetUploads.expiresAt, now),
            inArray(assetUploads.assetID, requestedIDs)
          )
        )
    : [];
  const activeReferences = current.filter(
    ({ pendingUntil }) => !pendingUntil || pendingUntil > now
  );
  const grantedIDs = new Set([...activeReferences, ...uploads].map(({ assetID }) => assetID));
  for (const assetID of recoveryDocument ? getContentAssetIDs(recoveryDocument) : [])
    grantedIDs.add(assetID);
  const ready = requestedIDs.length
    ? await database
        .select({ id: assets.id })
        .from(assets)
        .where(
          and(
            eq(assets.workspaceID, workspaceID),
            eq(assets.status, "ready"),
            inArray(assets.id, requestedIDs)
          )
        )
        .for("key share")
    : [];
  const allowedIDs = new Set(ready.filter(({ id }) => grantedIDs.has(id)).map(({ id }) => id));
  let changed = false;
  const normalize = (node: ContentNode): ContentNode => {
    if (
      node.type === "image" &&
      node.attrs?.assetID &&
      !allowedIDs.has(parseAssetID(node.attrs.assetID) || "")
    ) {
      changed = true;
      return { ...node, attrs: { ...node.attrs, assetID: null } };
    }
    return node.content ? { ...node, content: node.content.map(normalize) } : node;
  };
  const normalizedDocument = normalize(document);
  const removedIDs = current
    .filter(
      ({ assetID, pendingUntil }) =>
        !allowedIDs.has(assetID) && (pendingUntil ? pendingUntil <= now : !restoreUntil)
    )
    .map(({ assetID }) => assetID);
  const restorableIDs = restoreUntil
    ? current
        .filter(({ assetID, pendingUntil }) => !pendingUntil && !allowedIDs.has(assetID))
        .map(({ assetID }) => assetID)
    : [];

  if (restorableIDs.length) {
    // Keep an entry-scoped Undo grant. Later saves must not extend its deadline.
    await database
      .update(entryAssets)
      .set({ pendingUntil: restoreUntil })
      .where(and(scope, inArray(entryAssets.assetID, restorableIDs)));
  }

  if (removedIDs.length) {
    await database.delete(entryAssets).where(and(scope, inArray(entryAssets.assetID, removedIDs)));
  }
  if (allowedIDs.size) {
    await database
      .update(assets)
      .set({ unreferencedAt: null })
      .where(and(inArray(assets.id, [...allowedIDs]), isNotNull(assets.unreferencedAt)));
    await database
      .insert(entryAssets)
      .values([...allowedIDs].map((assetID) => ({ workspaceID, entryID, assetID })))
      .onConflictDoUpdate({
        target: [entryAssets.entryID, entryAssets.assetID],
        set: { pendingUntil: null },
        setWhere: isNotNull(entryAssets.pendingUntil)
      });
  }
  return { document: normalizedDocument, changed };
};

export { getContentAssetIDs, retainVersionAssets, syncEntryAssets };
