import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import * as z from "zod";
import { completeChannel, completePath } from "./completion";
import type { ToolContext } from "./context";

type PromptName =
  "draft-entry" | "update-docs" | "review-entry" | "answer" | "release-notes" | "reorganize";

const userPrompt = (lines: Array<string | false | undefined>): GetPromptResult => {
  const text = lines.filter((line) => typeof line === "string").join("\n");

  return { messages: [{ role: "user", content: { type: "text", text } }] };
};
const entryArgument = (context: ToolContext, description: string) => {
  return completable(z.string().describe(description), (value) => {
    return completePath(context, value, { entries: true });
  });
};
const collectionArgument = (context: ToolContext, description: string) => {
  return completable(z.string().describe(description), (value) => completePath(context, value));
};
const optionalCollectionArgument = (context: ToolContext, description: string) => {
  return completable(z.string().optional().describe(description), (value) => {
    return completePath(context, value ?? "");
  });
};

const registerDraftEntry = (server: McpServer, context: ToolContext) => {
  server.registerPrompt(
    "draft-entry",
    {
      title: "Draft an entry",
      description: "Write a new unpublished entry that follows the collection's schema and style",
      argsSchema: {
        topic: z.string().describe("What the entry is about"),
        collection: collectionArgument(context, "Collection path for the entry, such as /Docs")
      }
    },
    ({ topic, collection }) => {
      return userPrompt([
        `Draft a new Andesine entry about: ${topic}`,
        `Put it in the collection ${collection}.`,
        "",
        "1. Search for related entries and read two or three of them, to match their structure, tone, and terms.",
        `2. Read the schema of ${collection} with get_schema, and fill the required fields.`,
        "3. Link to related entries with entry: links, and don't repeat what they already explain.",
        "4. Create the entry with create_entry. Don't publish it.",
        "5. Reply with the entry path and link, and list anything that I must check."
      ]);
    }
  );
};
const registerUpdateDocs = (server: McpServer, context: ToolContext) => {
  server.registerPrompt(
    "update-docs",
    {
      title: "Update docs for a change",
      description: "Find the entries that a change affects and update them",
      argsSchema: {
        change: z.string().describe("The change: a description, release notes, or a diff"),
        collection: optionalCollectionArgument(context, "Collection path to limit the search")
      }
    },
    ({ change, collection }) => {
      return userPrompt([
        "Update the Andesine content for this change:",
        "",
        change,
        "",
        "1. Search for every entry that the change affects" +
          (collection ? ` in ${collection}.` : ".") +
          " Use several queries: names, terms, and examples that the change touches.",
        "2. Read each match and decide if it must change. Skip entries that only mention the topic.",
        "3. Change only the affected parts with edit_entry. Keep the style of each entry.",
        "4. Don't publish. Reply with the changed entries, a one-line summary for each, and the entries that you skipped and why."
      ]);
    }
  );
};
const registerReviewEntry = (server: McpServer, context: ToolContext) => {
  server.registerPrompt(
    "review-entry",
    {
      title: "Review an entry",
      description: "Find problems in an entry without changing it",
      argsSchema: { entry: entryArgument(context, "Entry path, such as /Docs/Getting started") }
    },
    ({ entry }) => {
      return userPrompt([
        `Review the Andesine entry ${entry}. Don't change it.`,
        "",
        "Read it with fetch, then check:",
        "- Facts that conflict with other entries (search for the main terms and claims).",
        "- Links to entries that don't exist, and references that look wrong.",
        "- Empty or wrong schema fields (compare with get_schema).",
        "- Unclear text, mistakes, and parts that don't match the style of related entries.",
        "",
        "Reply with a list of problems, each with the quote, the reason, and a fix. Say if you found none."
      ]);
    }
  );
};
const registerAnswer = (server: McpServer) => {
  server.registerPrompt(
    "answer",
    {
      title: "Answer from the workspace",
      description: "Answer a question only from workspace content, with citations",
      argsSchema: { question: z.string().describe("The question") }
    },
    ({ question }) => {
      return userPrompt([
        `Answer this question from the Andesine workspace: ${question}`,
        "",
        "Search with several queries, and read the best matches with fetch. Use only what the entries say.",
        "Cite each fact with the entry path and link. If the workspace doesn't answer the question, say so, and list the closest entries."
      ]);
    }
  );
};
const registerReleaseNotes = (server: McpServer, context: ToolContext) => {
  server.registerPrompt(
    "release-notes",
    {
      title: "Summarize unpublished changes",
      description: "Compare the drafts with the published content and summarize the changes",
      argsSchema: {
        path: entryArgument(context, "Entry or collection path"),
        channel: completable(
          z.string().optional().describe("Publishing channel code (default: published)"),
          (value) => completeChannel(context, value ?? "")
        )
      }
    },
    ({ path, channel }) => {
      return userPrompt([
        `Summarize what changed in ${path} since it was last published` +
          ` on the ${channel || "published"} channel.`,
        "",
        "If it's a collection, list its entries with get_tree. For each entry, read the current content and the published content (fetch with scope published), and compare them.",
        "Write short release notes grouped by entry: what was added, changed, and removed. List new entries that aren't published yet. Skip entries with no changes. Don't publish anything."
      ]);
    }
  );
};
const registerReorganize = (server: McpServer, context: ToolContext) => {
  server.registerPrompt(
    "reorganize",
    {
      title: "Reorganize a collection",
      description: "Propose a better structure for a collection, and apply it after approval",
      argsSchema: { collection: collectionArgument(context, "Collection path, such as /Docs") }
    },
    ({ collection }) => {
      return userPrompt([
        `Propose a better structure for the Andesine collection ${collection}.`,
        "",
        "1. List it with get_tree (depth 3), and read entries where the name doesn't show the topic.",
        "2. Propose moves, renames, and new collections, as a list of changes from path to path, with the reason for each. Note duplicate entries, but don't delete anything.",
        "3. Wait for my approval. Then apply only the approved changes with move, and reply with the result."
      ]);
    }
  );
};

const prompts: Record<PromptName, (server: McpServer, context: ToolContext) => void> = {
  "draft-entry": registerDraftEntry,
  "update-docs": registerUpdateDocs,
  "review-entry": registerReviewEntry,
  "answer": registerAnswer,
  "release-notes": registerReleaseNotes,
  "reorganize": registerReorganize
};

export { prompts };
export type { PromptName };
