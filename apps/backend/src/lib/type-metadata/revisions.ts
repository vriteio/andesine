import { effectiveSchemaRevisions } from "#backend/db";
import type { Database } from "#backend/lib/policy";
import { mapSchemaRevision } from "#backend/lib/schema/recorded";
import { and, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

/** Load recorded definitions once, with no per-entry schema reads. */
const loadMetadataRevisions = async (
  database: Database,
  workspaceID: string,
  revisionIDs: string[]
) => {
  const uniqueIDs = [...new Set(revisionIDs)];

  if (!uniqueIDs.length) return [];

  const rows = await database
    .select()
    .from(effectiveSchemaRevisions)
    .where(
      and(
        eq(effectiveSchemaRevisions.workspaceID, workspaceID),
        inArray(effectiveSchemaRevisions.id, uniqueIDs)
      )
    );

  if (rows.length !== uniqueIDs.length) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Recorded schema metadata is unavailable",
      data: {
        hints: [
          "Ask an administrator to check the recorded schema revisions before generating types."
        ]
      }
    });
  }

  return rows.map(mapSchemaRevision);
};

export { loadMetadataRevisions };
