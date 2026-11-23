import { contentNodeType } from "@andesine/document";
import { entryName } from "../content/name";
import { commentContentType, commentThreadType } from "../entities/comments";
import { id } from "../primitives/id";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";
import { pageInputType, paginationType } from "./schemas/pagination";

const commentBodyType = z.object({
  content: commentContentType.describe(
    "Text of the comment, in Markdown: **bold**, _italic_, ~~strikethrough~~, `code`, [links](url)"
  ),
  mentionIDs: z.array(id()).max(50).default([]).describe("Memberships to mention")
});
const suggestionPatchType = z.object({
  blockIDs: z
    .array(z.string().max(64))
    .max(500)
    .describe("Consecutive blocks to replace; empty to insert blocks"),
  after: z
    .string()
    .max(64)
    .nullable()
    .default(null)
    .describe("For an insertion: block after which the blocks go, or null for the start"),
  blocks: z.array(contentNodeType).max(500).optional().describe("Suggested blocks"),
  mdx: z.string().max(100000).optional().describe("Suggested blocks in MDX, instead of blocks"),
  title: entryName()
    .optional()
    .describe("Suggested entry title, instead of blocks; leave blockIDs empty")
});
const hasOnePatchSource = (input: { blocks?: unknown; mdx?: string; title?: string }) => {
  return (
    [input.blocks, input.mdx, input.title].filter((source) => source !== undefined).length === 1
  );
};
const patchSourceError = { message: "Set blocks, mdx or title", path: ["blocks"] };
const commentsContract = baseContract.router({
  list: authenticatedContract
    .route({
      summary: "List comment threads",
      description:
        "Lists the comment threads of an entry with their comments, oldest first. Use pagination.nextCursor to continue with the same filters.",
      tags: ["comments"],
      method: "GET",
      path: "/entries/{entryID}/comment-threads"
    })
    .meta({ example: { entryID: "ent_example" } })
    .meta({ required: { session: true, key: ["read:entries"] } })
    .input(
      pageInputType.extend({
        entryID: id().describe("ID of the entry"),
        resolved: z.boolean().optional().describe("Only resolved or only open threads")
      })
    )
    .output(z.object({ data: z.array(commentThreadType), pagination: paginationType })),
  createThread: authenticatedContract
    .route({
      summary: "Create a comment thread",
      description:
        "Starts a comment thread on an entry, a block (blockID) or a text range (quote). A quote is plain text as readers see it, with blocks and hard breaks as line breaks (\\n). It must occur once in the entry, or in the block when blockID is set, unless offset gives its position. A suggestion replaces a quote within one paragraph, without line breaks; suggest changes whole blocks.",
      tags: ["comments"],
      method: "POST",
      path: "/entries/{entryID}/comment-threads"
    })
    .meta({ example: { entryID: "ent_example", quote: "teh", content: "Typo", suggestion: "the" } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      commentBodyType
        .extend({
          entryID: id().describe("ID of the entry"),
          blockID: z.string().max(64).optional().describe("ID of the block"),
          quote: z.string().min(1).max(10000).optional().describe("Commented text"),
          suggestion: z.string().max(10000).optional().describe("Replacement for the quote"),
          offset: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Position of the quote in the plain text of the block, or of the entry")
        })
        .refine((input) => input.offset === undefined || input.quote, {
          message: "An offset needs a quote",
          path: ["offset"]
        })
        .refine((input) => input.suggestion === undefined || input.quote, {
          message: "A suggestion needs a quote",
          path: ["suggestion"]
        })
    )
    .output(commentThreadType),
  reply: authenticatedContract
    .route({
      summary: "Reply to a comment thread",
      tags: ["comments"],
      method: "POST",
      path: "/comment-threads/{threadID}/comments"
    })
    .meta({ example: { threadID: "cth_example", content: "Done." } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(commentBodyType.extend({ threadID: id().describe("ID of the comment thread") }))
    .output(commentThreadType),
  update: authenticatedContract
    .route({
      summary: "Update a comment",
      description: "Changes your own comment. Omitted mentions stay unchanged.",
      tags: ["comments"],
      method: "PATCH",
      path: "/comments/{id}"
    })
    .meta({ example: { id: "cmt_example", content: "Please check this again." } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      commentBodyType.extend({
        id: id().describe("ID of the comment"),
        mentionIDs: z
          .array(id())
          .max(50)
          .optional()
          .describe("Memberships to mention; unchanged when omitted")
      })
    )
    .output(commentThreadType),
  delete: authenticatedContract
    .route({
      summary: "Delete a comment",
      description:
        "Deletes your own comment, or any comment with permission to resolve. Deleting the first comment deletes the thread.",
      tags: ["comments"],
      method: "DELETE",
      path: "/comments/{id}"
    })
    .meta({ example: { id: "cmt_example" } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(z.object({ id: id().describe("ID of the comment") }))
    .output(z.void()),
  resolve: authenticatedContract
    .route({
      summary: "Resolve or reopen a comment thread",
      description:
        "Resolves a thread, or reopens it with resolved false. A suggestion that no longer applies to the current content can't be reopened; update it instead, which reopens it.",
      tags: ["comments"],
      method: "POST",
      path: "/comment-threads/{id}/resolve"
    })
    .meta({ example: { id: "cth_example", resolved: true } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      z.object({
        id: id().describe("ID of the comment thread"),
        resolved: z.boolean().describe("True to resolve, false to reopen")
      })
    )
    .output(commentThreadType),
  suggest: authenticatedContract
    .route({
      summary: "Suggest a change",
      description:
        "Starts a comment thread that suggests replacing consecutive blocks (blockIDs) with other blocks, inserting blocks (after), or a new entry title (title). Block IDs come from entries.get with contentFormat blocks. People with permission to update the entry can apply it. When your own open suggestion without replies or a note overlaps it, that thread gets the new change, which wins where both change the same words, and returns.",
      tags: ["comments"],
      method: "POST",
      path: "/entries/{entryID}/suggestions"
    })
    .meta({
      example: { entryID: "ent_example", blockIDs: ["blk_example"], mdx: "New paragraph text." }
    })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      suggestionPatchType
        .extend({
          entryID: id().describe("ID of the entry"),
          content: z.string().trim().max(10000).default("").describe("Text of the comment"),
          mentionIDs: z.array(id()).max(50).default([]).describe("Memberships to mention")
        })
        .refine(hasOnePatchSource, patchSourceError)
    )
    .output(commentThreadType),
  updateSuggestion: authenticatedContract
    .route({
      summary: "Update a suggestion",
      description:
        "Replaces the change of your own suggestion, against the current content. A suggestion resolved because it no longer applied reopens.",
      tags: ["comments"],
      method: "PUT",
      path: "/comment-threads/{id}/suggestion"
    })
    .meta({ example: { id: "cth_example", blockIDs: ["blk_example"], mdx: "Other text." } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      suggestionPatchType
        .extend({ id: id().describe("ID of the comment thread") })
        .refine(hasOnePatchSource, patchSourceError)
    )
    .output(commentThreadType),
  apply: authenticatedContract
    .route({
      summary: "Apply a suggestion",
      description:
        "Replaces the blocks or the title with the suggested ones and resolves the thread. Edits made since the suggestion was saved are kept; fails when they change the same words, attributes or blocks.",
      tags: ["comments"],
      method: "POST",
      path: "/comment-threads/{id}/apply"
    })
    .meta({ example: { id: "cth_example" } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(z.object({ id: id().describe("ID of the comment thread with the suggestion") }))
    .output(commentThreadType),
  setApplied: authenticatedContract
    .route({
      summary: "Mark a suggestion applied",
      description:
        "For editors that change the content themselves: marks an open suggestion applied and resolves it, or reopens an applied one, e.g. on undo. The content isn't changed.",
      tags: ["comments"],
      method: "PUT",
      path: "/comment-threads/{id}/applied"
    })
    .meta({ example: { id: "cth_example", applied: true } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      z.object({
        id: id().describe("ID of the comment thread with the suggestion"),
        applied: z.boolean().describe("True to mark it applied, false to reopen it")
      })
    )
    .output(commentThreadType)
});

export { commentsContract };
