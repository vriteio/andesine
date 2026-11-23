import { contentNodeType } from "@andesine/document";
import { id } from "../primitives/id";
import * as z from "zod";

const commentAnchorType = z.object({
  start: z.base64().max(1024).describe("Encoded Y.js relative position of the anchor start"),
  end: z.base64().max(1024).describe("Encoded Y.js relative position of the anchor end")
});
const commentAnchorStatusType = z
  .enum(["active", "outdated", "orphaned"])
  .describe(
    "active: the anchor matches, or the suggestion applies on top of edits made since; outdated: the anchored text changed, or the suggestion conflicts with edits of the same words; orphaned: the text or blocks are gone. Open suggestions that no longer apply are resolved, and reopen when they apply again"
  );
const commentContentType = z.string().trim().min(1).max(10000);
const commentSuggestionType = z.object({
  blockIDs: z
    .array(z.string())
    .describe("Consecutive blocks that the suggestion replaces; empty for an insertion"),
  after: z
    .string()
    .nullable()
    .describe("Block after which an insertion goes, or null for the start of the entry"),
  base: z.array(contentNodeType).describe("The replaced blocks when the suggestion was saved"),
  blocks: z.array(contentNodeType).describe("Suggested blocks, empty for a deletion"),
  title: z
    .object({
      base: z.string().describe("The entry title when the suggestion was saved"),
      suggested: z.string().describe("Suggested entry title")
    })
    .optional()
    .describe("Suggested entry title; its blocks are empty")
});
const commentType = z.object({
  id: id().describe("ID of the comment"),
  threadID: id().describe("ID of the comment thread"),
  authorID: id().nullable().describe("Membership that wrote the comment, or null when removed"),
  content: z.string().describe("Text of the comment"),
  mentionIDs: z.array(id()).describe("Memberships mentioned in the comment"),
  createdAt: z.iso.datetime().describe("Time when the comment was created"),
  updatedAt: z.iso.datetime().describe("Time when the comment was last updated")
});
const commentThreadType = z.object({
  id: id().describe("ID of the comment thread"),
  entryID: id().describe("ID of the commented entry"),
  blockID: z.string().nullable().describe("ID of the commented block, or null for the entry"),
  anchor: commentAnchorType.nullable().describe("Text range of the thread, or null for a block"),
  quote: z.string().nullable().describe("Commented text when the thread was created"),
  status: commentAnchorStatusType,
  text: z.string().nullable().describe("Current text of the range, or null for none"),
  suggestion: commentSuggestionType.nullable().describe("Suggested change, or null for none"),
  appliedAt: z.iso.datetime().nullable().describe("Time when the suggestion was applied"),
  authorID: id().nullable().describe("Membership that created the thread, or null when removed"),
  resolvedAt: z.iso.datetime().nullable().describe("Time when the thread was resolved"),
  resolvedByID: id().nullable().describe("Membership that resolved the thread"),
  autoResolved: z
    .boolean()
    .describe(
      "Whether the thread was resolved as its suggestion can't apply; it reopens once it can"
    ),
  createdAt: z.iso.datetime().describe("Time when the thread was created"),
  comments: z.array(commentType).describe("Comments of the thread, oldest first")
});
type CommentAnchor = z.infer<typeof commentAnchorType>;
type CommentAnchorStatus = z.infer<typeof commentAnchorStatusType>;
type Comment = z.infer<typeof commentType>;
type CommentSuggestion = z.infer<typeof commentSuggestionType>;
type CommentThread = z.infer<typeof commentThreadType>;
export {
  commentAnchorStatusType,
  commentAnchorType,
  commentContentType,
  commentSuggestionType,
  commentThreadType,
  commentType
};
export type { Comment, CommentAnchor, CommentAnchorStatus, CommentSuggestion, CommentThread };
