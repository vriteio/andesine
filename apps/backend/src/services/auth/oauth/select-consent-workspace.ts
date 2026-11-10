import { memberships, workspaces } from "@andesine/server/database";
import { db } from "#backend/lib/adapters/postgres";
import { redis } from "#backend/lib/adapters/redis";
import { getConsentWorkspaceKey } from "#backend/lib/auth/consent-workspace";
import { toUUID } from "@andesine/contracts/primitives";
import { APIError } from "better-auth/api";
import { and, eq, isNull } from "drizzle-orm";

interface SelectConsentWorkspaceInput {
  sessionID: string;
  userID: string;
  workspaceID: string;
}

const CONSENT_WORKSPACE_SECONDS = 10 * 60;

const selectConsentWorkspace = async (input: SelectConsentWorkspaceInput): Promise<void> => {
  let workspaceUUID: string;

  try {
    workspaceUUID = toUUID(input.workspaceID);
  } catch {
    throw new APIError("BAD_REQUEST", {
      error: "invalid_request",
      error_description: "The workspace ID isn't valid."
    });
  }

  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceID))
    .where(
      and(
        eq(memberships.workspaceID, workspaceUUID),
        eq(memberships.userID, toUUID(input.userID)),
        isNull(workspaces.deletingAt)
      )
    );

  if (!membership) {
    throw new APIError("FORBIDDEN", {
      error: "access_denied",
      error_description: "You aren't a member of this workspace."
    });
  }

  await redis.set(getConsentWorkspaceKey(input.sessionID), input.workspaceID, {
    EX: CONSENT_WORKSPACE_SECONDS
  });
};

export { selectConsentWorkspace };
