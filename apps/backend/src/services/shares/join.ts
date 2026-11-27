import {
  entries,
  entryShares,
  users,
  visitors,
  visitorTokens,
  workspaces
} from "@andesine/server/database";
import {
  publicID,
  toEntryID,
  toUserID,
  toUUID,
  toWorkspaceID
} from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "#backend/lib/adapters";
import { resolveUserAuthorization } from "#backend/lib/auth/user-authorization";
import { getEffectivePlan } from "#backend/lib/billing";
import { loadAuthorizedCollectionTree } from "#backend/lib/policy";
import { enforceRateLimit, RATE_LIMITS } from "#backend/lib/security";
import {
  ACCOUNT_TOKEN_LIFETIME,
  createVisitorToken,
  isShareKindEnabled
} from "#backend/lib/shares";

interface JoinShareInput {
  code: string;
  userID?: string;
  clientIP: string;
}

type JoinedShare =
  { type: "visitor"; token: string } | { type: "member"; workspaceID: string; entryID: string };
type ShareRow = typeof entryShares.$inferSelect;

/** Drizzle wraps the database error in `cause`. */
const isForeignKeyViolation = (error: unknown) => {
  const { code, cause } = (error ?? {}) as { code?: unknown; cause?: { code?: unknown } };

  return code === "23503" || cause?.code === "23503";
};
const notFoundError = () => {
  return new ORPCError("NOT_FOUND", { message: "The share was removed or has expired" });
};
/** A reset or removal deleted the share, or its unused visitor, meanwhile. */
const toNotFound = (error: unknown): never => {
  throw isForeignKeyViolation(error) ? notFoundError() : error;
};
const canMemberRead = async (userID: string, workspaceID: string, collectionID: string | null) => {
  try {
    const auth = await resolveUserAuthorization({
      userID: toUserID(userID),
      type: "session",
      headers: new Headers({ "x-workspace-id": toWorkspaceID(workspaceID) })
    });
    // Free plan workspaces are open to admins only.
    const canOpen = auth.session?.admin || getEffectivePlan(auth.subscriptionPlan) === "pro";
    const authorization = await loadAuthorizedCollectionTree({ auth });

    return Boolean(canOpen) && authorization.canEntry(collectionID, "entry:read");
  } catch {
    return false;
  }
};
/** Per IP and share; codes that aren't found count per IP, so they can't be guessed quickly. */
const limitNewVisitors = async (clientIP: string, share?: ShareRow) => {
  await enforceRateLimit({
    scope: "share-join",
    key: share ? `${clientIP}:${share.id}` : clientIP,
    // People behind one IP, e.g. an office, can open a found share many times.
    limit: share ? RATE_LIMITS.shareJoin : RATE_LIMITS.shareJoinNotFound,
    message: "Too many attempts. Try again later."
  });

  // Only commenting visitors write, so view links stay open to large audiences.
  if (share?.access === "comment") {
    await enforceRateLimit({
      scope: "share-join-share",
      key: share.id,
      limit: RATE_LIMITS.shareJoinPerShare,
      message: "Too many people opened the share. Try again later."
    });
  }
};
/** Signed-in people join as themselves; members who can read the entry get the workspace entry. */
const joinShare = async (input: JoinShareInput): Promise<JoinedShare> => {
  const isEmailShare = publicID("shr").safeParse(input.code).success;
  const [target] = await db
    .select({ share: entryShares, collectionID: entries.collectionID })
    .from(entryShares)
    .innerJoin(entries, eq(entries.id, entryShares.entryID))
    .innerJoin(workspaces, eq(workspaces.id, entryShares.workspaceID))
    .where(
      and(
        isEmailShare
          ? and(eq(entryShares.id, toUUID(input.code)), eq(entryShares.kind, "email"))
          : and(eq(entryShares.token, input.code), eq(entryShares.kind, "link")),
        or(isNull(entryShares.expiresAt), gt(entryShares.expiresAt, new Date())),
        isNull(entries.deletedAt),
        isNull(workspaces.deletingAt),
        isShareKindEnabled
      )
    );

  if (!target) {
    await limitNewVisitors(input.clientIP);
    throw notFoundError();
  }

  const { share, collectionID } = target;
  const [user] = input.userID
    ? await db
        .select()
        .from(users)
        .where(eq(users.id, toUUID(input.userID)))
    : [];
  const isOtherEmail = !user?.emailVerified || user.email.toLowerCase() !== share.email;

  if (share.kind === "email" && !user) throw new ORPCError("UNAUTHORIZED");

  if (share.kind === "email" && isOtherEmail) {
    throw new ORPCError("FORBIDDEN", {
      message: "The entry is shared with another email address",
      data: { hints: ["Sign in with the email address that the share was sent to."] }
    });
  }

  // Accounts join on each visit, which the new visitor limits don't count.
  if (user) {
    await enforceRateLimit({
      scope: "share-join-account",
      key: `${user.id}:${share.id}`,
      limit: RATE_LIMITS.shareJoin,
      message: "Too many attempts. Try again later."
    });
  }

  if (user && (await canMemberRead(user.id, share.workspaceID, collectionID))) {
    return {
      type: "member",
      workspaceID: toWorkspaceID(share.workspaceID),
      entryID: toEntryID(share.entryID)
    };
  }

  const token = createVisitorToken();
  const [existing] = user
    ? await db
        .select({ id: visitors.id })
        .from(visitors)
        .where(and(eq(visitors.shareID, share.id), eq(visitors.userID, user.id)))
    : [];

  // Only new visitors count, so people who sign in again aren't blocked.
  if (!existing) await limitNewVisitors(input.clientIP, share);

  const name = user?.name.slice(0, 50) ?? null;
  const insert = db
    .insert(visitors)
    .values({ workspaceID: share.workspaceID, shareID: share.id, userID: user?.id ?? null, name });
  const [visitor] = await (
    user
      ? insert.onConflictDoUpdate({
          target: [visitors.shareID, visitors.userID],
          targetWhere: isNotNull(visitors.userID),
          set: { name }
        })
      : insert
  )
    .returning({ id: visitors.id })
    .catch(toNotFound);

  await db
    .insert(visitorTokens)
    .values({ visitorID: visitor.id, tokenHash: token.hash })
    .catch(toNotFound);

  // Accounts join on each visit; their old tokens expire.
  if (existing) {
    await db
      .delete(visitorTokens)
      .where(
        and(
          eq(visitorTokens.visitorID, visitor.id),
          lt(visitorTokens.createdAt, new Date(Date.now() - ACCOUNT_TOKEN_LIFETIME))
        )
      );
  }

  return { type: "visitor", token: token.raw };
};

export { joinShare };
