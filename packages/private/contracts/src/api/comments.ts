import { commentContentType, commentSuggestionType, commentThreadType } from "../entities/comments";
import { id } from "../primitives/id";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";
import { pageInputType, paginationType } from "./schemas/pagination";

const commentBodyType = z.object({
  content: commentContentType.describe("Text of the comment"),
  mentionIDs: z.array(id()).max(50).default([]).describe("Memberships to mention"),
  suggestion: commentSuggestionType
    .nullable()
    .optional()
    .describe("Suggested replacement for the quoted text of the thread")
});
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
        "Starts a comment thread on an entry, a block (blockID) or a text range (quote). A quote is plain text as readers see it, with blocks and hard breaks as line breaks (\\n). It must occur once in the entry, or in the block when blockID is set, unless offset gives its position. A suggestion needs a quote within one paragraph, without line breaks.",
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
        .refine((input) => input.suggestion == null || input.quote, {
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
      description:
        "Changes your own comment. Omitted mentions and suggestion stay unchanged. An applied suggestion cannot change.",
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
  apply: authenticatedContract
    .route({
      summary: "Apply a suggestion",
      description:
        "Replaces the quoted text with the suggestion and resolves the thread. Fails when the quoted text changed.",
      tags: ["comments"],
      method: "POST",
      path: "/comments/{id}/apply"
    })
    .meta({ example: { id: "cmt_example" } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(z.object({ id: id().describe("ID of the comment with the suggestion") }))
    .output(commentThreadType)
});

export { commentsContract };
