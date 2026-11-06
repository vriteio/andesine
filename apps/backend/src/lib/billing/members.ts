// SPDX-License-Identifier: Elastic-2.0
import { invitations, memberships, type DatabaseTransaction } from "@andesine/server/database";
import type { db } from "#backend/lib/adapters/postgres";
import { ORPCError } from "@orpc/server";
import { and, count, eq, gt } from "drizzle-orm";

/** Members and pending invites on the Free plan; all of them are admins. */
const FREE_MEMBER_LIMIT = 3;

const countMembers = async (
  executor: DatabaseTransaction | typeof db,
  workspaceUUID: string
): Promise<number> => {
  const [{ value }] = await executor
    .select({ value: count() })
    .from(memberships)
    .where(eq(memberships.workspaceID, workspaceUUID));

  return value;
};
const countPendingInvites = async (
  tx: DatabaseTransaction,
  workspaceUUID: string
): Promise<number> => {
  const [{ value }] = await tx
    .select({ value: count() })
    .from(invitations)
    .where(
      and(
        eq(invitations.workspaceID, workspaceUUID),
        eq(invitations.status, "pending"),
        // Expired invites stay pending until the invite list marks them.
        gt(invitations.expiresAt, new Date())
      )
    );

  return value;
};
const throwFreeMemberLimit = (): never => {
  throw new ORPCError("FORBIDDEN", {
    message: `The Free plan has up to ${FREE_MEMBER_LIMIT} members, including pending invites`,
    data: {
      requiredPlan: "pro",
      hints: ["Upgrade to Andesine Pro, or revoke a pending invite, to invite more members."]
    }
  });
};

export { countMembers, countPendingInvites, FREE_MEMBER_LIMIT, throwFreeMemberLimit };
