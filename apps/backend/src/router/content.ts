import {
  authorized,
  getCacheHeaders,
  hashEntityTag,
  matchesEntityTag
} from "#backend/lib/transport";
import { Asset } from "#backend/services/assets";
import { Publishing } from "#backend/services/publishing";
import { api } from "./implement";

const handlers = api.content;
const authorizedHandlers = handlers.use(authorized);
const contentRouter = handlers.router({
  listCollections: authorizedHandlers.listCollections.handler(({ context, input }) =>
    Publishing.Collections.listContent({ ...input, workspaceID: context.auth.workspaceID })
  ),
  listEntries: authorizedHandlers.listEntries.handler(({ context, input }) =>
    Publishing.Entries.listContent({ ...input, workspaceID: context.auth.workspaceID })
  ),
  getSchema: authorizedHandlers.getSchema.handler(({ context, input }) =>
    Publishing.Entries.getSchema({ ...input, workspaceID: context.auth.workspaceID })
  ),
  getAsset: handlers.getAsset.handler(async ({ input }) => ({
    headers: {
      "Cache-Control": "private, no-store" as const,
      "X-Content-Type-Options": "nosniff" as const,
      "Content-Disposition": "inline" as const
    },
    body: await Asset.getPublished(input)
  })),
  get: authorizedHandlers.get.handler(async ({ context, input }) => {
    const content = await Publishing.Entries.getContent({
      workspaceID: context.auth.workspaceID,
      entryID: input.entryID,
      path: input.path,
      expectedSchemaHash: input.expectedSchemaHash,
      channel: input.channel,
      snapshotID: input.snapshotID
    });
    const entityTag = hashEntityTag(content);
    const headers = getCacheHeaders(entityTag);

    if (matchesEntityTag(context.reqHeaders?.get("If-None-Match"), entityTag)) {
      return { status: 304, headers } as const;
    }

    return { status: 200, headers, body: content } as const;
  }),
  getTree: authorizedHandlers.getTree.handler(async ({ context, input }) => {
    const content = await Publishing.Collections.getContentTree({
      workspaceID: context.auth.workspaceID,
      collectionID: input.collectionID,
      collectionPath: input.collectionPath,
      channel: input.channel,
      snapshotID: input.snapshotID
    });
    const entityTag = hashEntityTag(content);
    const headers = getCacheHeaders(entityTag);

    if (matchesEntityTag(context.reqHeaders?.get("If-None-Match"), entityTag)) {
      return { status: 304, headers } as const;
    }

    return { status: 200, headers, body: content } as const;
  })
});

export { contentRouter };
