import { visitors, type DatabaseClient } from "@andesine/server/database";
import { type Visitor } from "@andesine/contracts/entities";
import { toVisitorID, toUUID } from "@andesine/contracts/primitives";
import { inArray } from "drizzle-orm";
import { getUserAuthorization, type SessionData } from "#backend/lib/policy";

interface CommentAuthor {
  authorID: string | null;
  visitorID: string | null;
}

/** The member or the visitor that writes, as UUIDs. */
const getCommentAuthor = (auth: SessionData): CommentAuthor => {
  const memberID = getUserAuthorization(auth)?.memberID;

  return {
    authorID: memberID ? toUUID(memberID) : null,
    visitorID: auth.visitor ? toUUID(auth.visitor.visitorID) : null
  };
};
const isCommentAuthor = (auth: SessionData, written: CommentAuthor): boolean => {
  const { authorID, visitorID } = getCommentAuthor(auth);

  return (
    (Boolean(authorID) && authorID === written.authorID) ||
    (Boolean(visitorID) && visitorID === written.visitorID)
  );
};
const loadVisitors = async (
  database: DatabaseClient,
  rows: Array<{ visitorID: string | null }>
): Promise<Map<string, Visitor>> => {
  const ids = [...new Set(rows.flatMap(({ visitorID }) => (visitorID ? [visitorID] : [])))];

  if (!ids.length) return new Map();

  const found = await database
    .select({ id: visitors.id, name: visitors.name })
    .from(visitors)
    .where(inArray(visitors.id, ids));

  return new Map(found.map(({ id, name }) => [id, { id: toVisitorID(id), name }]));
};

export { getCommentAuthor, isCommentAuthor, loadVisitors };
export type { CommentAuthor };
