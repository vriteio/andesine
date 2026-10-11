import { type DatabaseTransaction as Database } from "@andesine/server/database";
import { assertRecordedContent, contentSchemaInvalidError } from "@andesine/server/schema";
import { type ContentSchemaIssue } from "@andesine/contracts/schema";
import { normalizeEntryDocument } from "@andesine/document/tiptap";
import { RESERVED_ELEMENT_NAMES, type ContentNode } from "@andesine/document";
import { createContentState, type ContentState } from "#backend/collaboration";
import { ORPCError } from "@orpc/server";
import { type AuthorizedCollectionTree } from "#backend/lib/policy";
import { resolveEntryLinks, type ContentPaths } from "./links";

interface PrepareEntryContentInput {
  entryID: string;
  schemaRevisionID: string | null;
  document: ContentNode;
  /** The caller's access, for the entries that links point to. */
  authorization: AuthorizedCollectionTree;
  paths?: ContentPaths;
}

const findReservedElement = (
  node: ContentNode,
  path: Array<string | number> = []
): ContentSchemaIssue | null => {
  const name = node.attrs?.name;

  if (node.type === "element" && RESERVED_ELEMENT_NAMES.includes(String(name))) {
    return {
      code: "invalid_structure",
      message: `${String(name)} is a reserved Element name`,
      path
    };
  }

  for (const [index, child] of (node.content || []).entries()) {
    const issue = findReservedElement(child, [...path, "content", index]);

    if (issue) return issue;
  }

  return null;
};
/**
 * Checks supplied content against the editor and the recorded schema, and applies the editor's
 * normalization, so opening it in the editor changes nothing.
 */
const prepareEntryContent = async (
  database: Database,
  workspaceID: string,
  input: PrepareEntryContentInput
): Promise<ContentState> => {
  const context = { entryID: input.entryID, schemaRevisionID: input.schemaRevisionID };
  const document = await resolveEntryLinks(
    database,
    workspaceID,
    input.document,
    input.authorization,
    input.paths
  );
  const reservedElement = findReservedElement(document);

  let content: ContentState;

  if (reservedElement) throw contentSchemaInvalidError(context, [reservedElement], 409);

  try {
    content = createContentState(normalizeEntryDocument(document));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Content doesn't match the editor";

    throw contentSchemaInvalidError(
      context,
      [{ code: "invalid_structure", message, path: [] }],
      409
    );
  }

  await assertRecordedContent(
    database,
    workspaceID,
    { ...context, document: content.document },
    409
  );

  return content;
};
const setContentTitle = (document: ContentNode, name: string): ContentNode => ({
  ...document,
  content: document.content?.map((node) => {
    return node.type === "title" ? { ...node, content: [{ type: "text", text: name }] } : node;
  })
});
/** @param changedIDs Entries of a bulk call that kept the change; they mustn't be changed again. */
const contentHashMismatchError = (hash: string, changedIDs: string[] = []) => {
  return new ORPCError("CONTENT_HASH_MISMATCH", {
    status: 409,
    message: "The current content has a different hash than expected",
    data: {
      hash,
      ...(changedIDs.length && { changedIDs }),
      hints: [
        "Read the entry again, apply the change to the current content, and retry.",
        ...(changedIDs.length
          ? ["The changedIDs entries already have the change; leave them out of the retry."]
          : [])
      ]
    }
  });
};

export { contentHashMismatchError, prepareEntryContent, setContentTitle };
