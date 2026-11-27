import { randomBytes } from "node:crypto";
import {
  comments,
  commentThreads,
  entries,
  entryShares,
  users,
  visitors,
  workspaces,
  type DatabaseClient
} from "@andesine/server/database";
import {
  type Share,
  type ShareAccess,
  type ShareKind,
  type SharingPolicy
} from "@andesine/contracts/entities";
import { type EntryAction } from "@andesine/contracts/permissions";
import {
  bytesToBase62,
  toEntryID,
  toMembershipID,
  toShareID,
  toUUID
} from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { db, sendEmail } from "#backend/lib/adapters";
import { config } from "#backend/lib/config";
import {
  type AuthorizedCollectionTree,
  getUserAuthorization,
  type SessionData
} from "#backend/lib/policy";
import { hashKey } from "#backend/lib/security";

interface ShareEntry {
  id: string;
  name: string;
  collectionID: string | null;
}
interface VisitorEntry {
  entryID: string;
  collectionID: string | null;
}
interface ListedShare extends Share {
  visitors: number;
}
interface ShareTarget {
  share: ShareRow;
  collectionID: string | null;
}

type ShareRow = typeof entryShares.$inferSelect;

const VISITOR_TOKEN_PREFIX = "and_vt_";
const DAY = 24 * 60 * 60 * 1000;
/** Accounts get a token on each join; anonymous visitors keep theirs. */
const ACCOUNT_TOKEN_LIFETIME = 30 * DAY;
/** Needs the share's workspace joined. */
const isShareKindEnabled = or(
  and(eq(entryShares.kind, "link"), eq(workspaces.linkSharing, true)),
  and(eq(entryShares.kind, "email"), eq(workspaces.emailSharing, true))
)!;

const createVisitorToken = () => {
  const raw = `${VISITOR_TOKEN_PREFIX}${bytesToBase62(randomBytes(32))}`;

  return { raw, hash: hashKey(raw) };
};
/** Base62, so it never looks like a share ID. */
const createLinkToken = () => bytesToBase62(randomBytes(18));
const isVisitorToken = (token: string) => token.startsWith(VISITOR_TOKEN_PREFIX);
const createShareURL = (code: string) =>
  new URL(`/share/${code}`, config.PUBLIC_APP_URL).toString();
const toExpiresAt = (expiresAt?: string | null) => {
  return expiresAt == null ? expiresAt : new Date(expiresAt);
};
const getCreatorID = (auth: SessionData) => {
  const memberID = getUserAuthorization(auth)?.memberID;

  return memberID ? toUUID(memberID) : null;
};
const mapShare = (row: ShareRow): Share => ({
  id: toShareID(row.id),
  entryID: toEntryID(row.entryID),
  kind: row.kind,
  access: row.access,
  token: row.token,
  email: row.email,
  createdByID: row.createdByID ? toMembershipID(row.createdByID) : null,
  expiresAt: row.expiresAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString()
});
const resolveShareEntry = async (
  database: DatabaseClient,
  workspaceID: string,
  entryID: string
): Promise<ShareEntry> => {
  const [entry] = await database
    .select({ id: entries.id, name: entries.name, collectionID: entries.collectionID })
    .from(entries)
    .where(
      and(
        eq(entries.id, toUUID(entryID)),
        eq(entries.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      )
    );

  if (!entry) throw new ORPCError("NOT_FOUND", { message: "Entry not found" });

  return entry;
};
/** Members can't give more access than they have. */
const getShareActions = (access: ShareAccess, collectionID: string | null, entryID: string) => {
  const actions: EntryAction[] =
    access === "comment" ? ["entry:share", "comment:create"] : ["entry:share"];

  return actions.map((action) => ({ action, collectionID, entryID }));
};
/** Needs a query on `entries`. */
const isShareableEntry = (authorization: AuthorizedCollectionTree) => {
  const collectionIDs = authorization.collections
    .filter(({ id }) => authorization.canEntry(id, "entry:share"))
    .map(({ id }) => toUUID(id));

  return (
    or(
      authorization.canEntry(null, "entry:share") ? isNull(entries.collectionID) : undefined,
      collectionIDs.length ? inArray(entries.collectionID, collectionIDs) : undefined
    ) ?? sql`false`
  );
};
const listEntryShares = async (
  database: DatabaseClient,
  workspaceID: string,
  entryIDs: string[]
): Promise<ListedShare[]> => {
  if (!entryIDs.length) return [];

  const rows = await database
    .select({ share: entryShares, visitors: count(visitors.id) })
    .from(entryShares)
    .leftJoin(visitors, eq(visitors.shareID, entryShares.id))
    .where(and(eq(entryShares.workspaceID, workspaceID), inArray(entryShares.entryID, entryIDs)))
    .groupBy(entryShares.id)
    .orderBy(asc(entryShares.kind), desc(entryShares.createdAt));

  return rows.map(({ share, visitors }) => ({ ...mapShare(share), visitors }));
};
const resolveShare = async (
  database: DatabaseClient,
  workspaceID: string,
  shareID: string
): Promise<ShareTarget> => {
  const [row] = await database
    .select({ share: entryShares, collectionID: entries.collectionID })
    .from(entryShares)
    .innerJoin(entries, eq(entries.id, entryShares.entryID))
    .where(
      and(
        eq(entryShares.id, toUUID(shareID)),
        eq(entryShares.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      )
    );

  if (!row) throw new ORPCError("NOT_FOUND", { message: "Share not found" });

  return row;
};
const resolveVisitorEntry = (auth: SessionData): VisitorEntry => {
  if (!auth.visitor) throw new ORPCError("FORBIDDEN");

  return { entryID: auth.visitor.entryID, collectionID: auth.visitor.collectionID };
};
const loadSharingPolicy = async (
  database: DatabaseClient,
  workspaceID: string
): Promise<SharingPolicy> => {
  const [policy] = await database
    .select({
      linkSharing: workspaces.linkSharing,
      emailSharing: workspaces.emailSharing,
      maxExpiryDays: workspaces.maxShareExpiryDays
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceID));

  if (!policy) throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });

  return policy;
};
const assertShareKindEnabled = (policy: SharingPolicy, kind: ShareKind) => {
  const enabled = kind === "link" ? policy.linkSharing : policy.emailSharing;

  if (!enabled) {
    throw new ORPCError("FORBIDDEN", {
      message: `${kind === "link" ? "Link" : "Email"} sharing is turned off in the workspace`,
      data: { hints: ["Ask a workspace administrator to turn it on in the sharing settings."] }
    });
  }
};
const limitExpiry = (policy: SharingPolicy, expiresAt: Date | null): Date | null => {
  if (!policy.maxExpiryDays) return expiresAt;

  const latest = new Date(Date.now() + policy.maxExpiryDays * DAY);

  return !expiresAt || expiresAt > latest ? latest : expiresAt;
};
/** Visitors without a share or comments; nothing shows their names any more. */
const removeUnusedVisitors = (database: DatabaseClient, workspaceID: string) => {
  return database
    .delete(visitors)
    .where(
      and(
        eq(visitors.workspaceID, workspaceID),
        isNull(visitors.shareID),
        notExists(
          database
            .select({ id: comments.id })
            .from(comments)
            .where(eq(comments.visitorID, visitors.id))
        ),
        notExists(
          database
            .select({ id: commentThreads.id })
            .from(commentThreads)
            .where(eq(commentThreads.visitorID, visitors.id))
        )
      )
    );
};
/** Failures are logged only; the share works without the email. */
const deliverShare = async (auth: SessionData, share: ShareRow, entryName: string) => {
  const userID = getUserAuthorization(auth)?.userID;
  const [sharer] = userID
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, toUUID(userID)))
    : [];

  try {
    await sendEmail(share.email!, "entry-share", {
      entryName,
      sharerName: sharer?.name || "Someone",
      access: share.access,
      shareLink: createShareURL(toShareID(share.id))
    });
  } catch (error) {
    console.error("Failed to deliver entry share email", { shareID: toShareID(share.id), error });
  }
};

export {
  ACCOUNT_TOKEN_LIFETIME,
  DAY,
  assertShareKindEnabled,
  createVisitorToken,
  createLinkToken,
  deliverShare,
  getCreatorID,
  getShareActions,
  isShareableEntry,
  isShareKindEnabled,
  isVisitorToken,
  limitExpiry,
  listEntryShares,
  loadSharingPolicy,
  mapShare,
  removeUnusedVisitors,
  resolveVisitorEntry,
  resolveShare,
  resolveShareEntry,
  toExpiresAt
};
export type { ListedShare, VisitorEntry, ShareEntry, ShareTarget };
