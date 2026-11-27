import { comments, commentThreads, visitors } from "@andesine/server/database";
import { and, eq, inArray, isNull, lt, notExists } from "drizzle-orm";
import { db } from "../database";

const UNUSED_VISITOR_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

/**
 * Removes anonymous visitors without a name or comments, unseen for 30 days, so view links don't
 * collect rows; such a visitor's page joins again when its token stops working.
 */
const removeUnusedVisitors = async (): Promise<void> => {
  const unused = and(
    isNull(visitors.userID),
    isNull(visitors.name),
    lt(visitors.lastSeenAt, new Date(Date.now() - UNUSED_VISITOR_AGE_MS)),
    notExists(
      db.select({ id: comments.id }).from(comments).where(eq(comments.visitorID, visitors.id))
    ),
    notExists(
      db
        .select({ id: commentThreads.id })
        .from(commentThreads)
        .where(eq(commentThreads.visitorID, visitors.id))
    )
  );

  let removed: number;

  do {
    const batch = db.select({ id: visitors.id }).from(visitors).where(unused).limit(BATCH_SIZE);
    const rows = await db
      .delete(visitors)
      .where(inArray(visitors.id, batch))
      .returning({ id: visitors.id });

    removed = rows.length;
  } while (removed === BATCH_SIZE);
};

export { removeUnusedVisitors };
