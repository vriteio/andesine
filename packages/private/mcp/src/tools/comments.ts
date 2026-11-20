import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { entryURL, resolveEntryID, runTool, type ToolContext } from "../context";

type CommentThread = Awaited<ReturnType<ToolContext["client"]["comments"]["list"]>>["data"][number];

const entrySchema = z.string().describe("Entry ID (ent_...) or path (/Collection/Entry)");
const readAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
};

const mapThread = (thread: CommentThread) => ({
  id: thread.id,
  status: thread.status,
  resolved: thread.resolvedAt !== null,
  blockID: thread.blockID ?? undefined,
  quote: thread.quote ?? undefined,
  currentText: thread.text !== thread.quote ? (thread.text ?? undefined) : undefined,
  comments: thread.comments.map((comment) => ({
    id: comment.id,
    authorID: comment.authorID,
    content: comment.content,
    mentions: comment.mentionIDs.length ? comment.mentionIDs : undefined,
    suggestion: comment.suggestion ?? undefined,
    applied: comment.appliedAt !== null || undefined
  }))
});
/** Pages through the members until each email is found; fails on unknown emails. */
const resolveMemberIDs = async (context: ToolContext, emails: string[]): Promise<string[]> => {
  const pending = new Set(emails.map((email) => email.toLowerCase()));
  const ids: string[] = [];
  let cursor: string | undefined;

  do {
    const { data, pagination } = await context.client.memberships.list({ cursor, limit: 100 });

    for (const member of data) {
      const email = member.profile.email.toLowerCase();

      if (pending.delete(email)) ids.push(member.id);
    }

    cursor = pagination.nextCursor ?? undefined;
  } while (cursor && pending.size);

  if (pending.size) {
    throw new Error(`No workspace members with these emails: ${[...pending].join(", ")}`);
  }

  return ids;
};
const registerListComments = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "list_comments",
    {
      title: "List comments",
      description:
        "Lists the comment threads of an entry; list_members has the names of authors and mentions. status: active (the quote matches), outdated (the quoted text changed; currentText has it), or orphaned (the text or block is gone).",
      inputSchema: {
        entry: entrySchema,
        resolved: z
          .boolean()
          .optional()
          .describe("Only resolved or only open threads (default: all)"),
        cursor: z.string().optional().describe("nextCursor from the previous page")
      },
      annotations: { ...readAnnotations, title: "List comments" }
    },
    runTool(async ({ entry, resolved, cursor }) => {
      const entryID = await resolveEntryID(context, entry);
      const { data, pagination } = await context.client.comments.list({
        entryID,
        resolved,
        cursor,
        limit: 100
      });

      return {
        threads: data.map(mapThread),
        nextCursor: pagination.nextCursor ?? undefined,
        url: entryURL(context, entryID)
      };
    })
  );
};
const registerAddComment = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "add_comment",
    {
      title: "Add a comment",
      description:
        "Starts a comment thread, or replies to one with thread. quote comments on text: plain text as readers see it (no MDX markup; \\n between blocks) that occurs once in the entry; add blockID (from fetch with format blocks) when it occurs more than once. blockID alone comments on a block, and neither comments on the entry. suggestion proposes a replacement for a quote within one paragraph that people can apply; use it instead of edit_entry to propose changes for review. mentions records which members the comment is for.",
      inputSchema: {
        entry: entrySchema.optional().describe("Entry for a new thread"),
        thread: z.string().optional().describe("Thread ID (cth_...) to reply to"),
        content: z
          .string()
          .min(1)
          .describe(
            "Text of the comment, in Markdown: **bold**, _italic_, ~~strike~~, `code`, [links](url)"
          ),
        quote: z.string().min(1).optional().describe("Text to comment on, for a new thread"),
        blockID: z.string().optional().describe("Block to comment on, for a new thread"),
        suggestion: z.string().optional().describe("Replacement for the quoted text"),
        mentions: z.array(z.email()).max(50).optional().describe("Emails of members to mention")
      },
      annotations: { ...writeAnnotations, title: "Add a comment" }
    },
    runTool(async ({ entry, thread, content, quote, blockID, suggestion, mentions }) => {
      const mentionIDs = mentions?.length ? await resolveMemberIDs(context, mentions) : undefined;
      const body = { content, suggestion, mentionIDs };

      if (thread) {
        if (entry || quote || blockID) {
          throw new Error("A reply takes thread, without entry, quote or blockID");
        }

        return mapThread(await context.client.comments.reply({ ...body, threadID: thread }));
      }

      if (!entry) throw new Error("Set entry for a new thread, or thread for a reply");

      const entryID = await resolveEntryID(context, entry);

      return mapThread(
        await context.client.comments.createThread({ ...body, entryID, quote, blockID })
      );
    })
  );
};
const registerResolveComment = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "resolve_comment",
    {
      title: "Resolve a comment thread",
      description: "Resolves a comment thread, or reopens it with resolved false.",
      inputSchema: {
        thread: z.string().describe("Thread ID (cth_...)"),
        resolved: z.boolean().default(true)
      },
      annotations: { ...writeAnnotations, idempotentHint: true, title: "Resolve a comment thread" }
    },
    runTool(async ({ thread, resolved }) => {
      return mapThread(await context.client.comments.resolve({ id: thread, resolved }));
    })
  );
};
const registerApplySuggestion = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "apply_suggestion",
    {
      title: "Apply a suggestion",
      description:
        "Replaces the quoted text with a comment's suggestion and resolves the thread. Fails when the quoted text changed.",
      inputSchema: { comment: z.string().describe("Comment ID (cmt_...) with the suggestion") },
      annotations: { ...writeAnnotations, title: "Apply a suggestion" }
    },
    runTool(async ({ comment }) => {
      return mapThread(await context.client.comments.apply({ id: comment }));
    })
  );
};

const registerListMembers = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "list_members",
    {
      title: "List workspace members",
      description:
        "Lists workspace members with their membership IDs (ms_...), names, emails and roles: emails for mentions, IDs for comment authors. Pass cursor from the previous page to continue.",
      inputSchema: {
        cursor: z.string().optional().describe("nextCursor from the previous page"),
        limit: z.number().int().min(1).max(100).default(100)
      },
      annotations: { ...readAnnotations, title: "List workspace members" }
    },
    runTool(async ({ cursor, limit }) => {
      const { data, pagination } = await context.client.memberships.list({ cursor, limit });

      return {
        members: data.map((member) => ({
          id: member.id,
          name: member.profile.name,
          email: member.profile.email,
          role: member.admin ? "Administrator" : member.roleName
        })),
        nextCursor: pagination.nextCursor ?? undefined
      };
    })
  );
};

const commentReadTools = { list_comments: registerListComments, list_members: registerListMembers };
const commentWriteTools = {
  add_comment: registerAddComment,
  resolve_comment: registerResolveComment,
  apply_suggestion: registerApplySuggestion
};

export { commentReadTools, commentWriteTools };
