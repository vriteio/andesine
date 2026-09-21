import { getUserAuthorization, type SessionData } from "#backend/lib/policy";
import { emitPublishingEntryUpdates, emitVersionEvent } from "#backend/events";
import { type VersionDetails, type VersionSummary } from "#backend/lib/data";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Versions } from "#backend/services/versions";
import { api } from "./implement";
const getContributorIDs = (auth: SessionData): string[] => {
  const memberID = getUserAuthorization(auth)?.memberID;

  return memberID ? [memberID] : [];
};
const toVersionSummary = ({
  document: _document,
  schema: _schema,
  ...version
}: VersionDetails): VersionSummary => {
  return version;
};
const handlers = api.versions;
const authorizedHandlers = handlers.use(authorized);
const versionsRouter = handlers.router({
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const version = await Versions.create({
      auth: context.auth,
      entryID: input.entryID,
      reason: "manual",
      contributorIDs: getContributorIDs(context.auth),
      name: input.name
    });

    emitVersionEvent(context.auth.workspaceID, {
      action: "version:create",
      data: toVersionSummary(version),
      memberID: getUserAuthorization(context.auth)?.memberID
    });

    return version;
  }),
  list: authorizedHandlers.list.handler(async ({ context, input }) => {
    const { versions, nextCursor } = await Versions.list({
      auth: context.auth,
      entryID: input.entryID,
      cursor: input.cursor,
      limit: input.limit
    });

    return {
      data: versions,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null
      }
    };
  }),
  get: authorizedHandlers.get.handler(({ context, input }) => {
    return Versions.get({
      auth: context.auth,
      versionID: input.id,
      expectedSchemaHash: input.expectedSchemaHash
    });
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    const version = await Versions.update({
      auth: context.auth,
      versionID: input.id,
      name: input.name
    });

    emitVersionEvent(context.auth.workspaceID, {
      action: "version:update",
      data: version,
      memberID: getUserAuthorization(context.auth)?.memberID
    });
  }),
  revert: authorizedHandlers.revert.handler(async ({ context, input }) => {
    const result = await Versions.revert({
      auth: context.auth,
      versionID: input.id,
      contributorIDs: getContributorIDs(context.auth)
    });

    for (const version of result.createdVersions) {
      emitVersionEvent(context.auth.workspaceID, {
        action: "version:create",
        data: toVersionSummary(version),
        memberID: getUserAuthorization(context.auth)?.memberID
      });
    }

    emitPublishingEntryUpdates({
      workspaceID: context.auth.workspaceID,
      entries: result.publishingEntries,
      memberID: getUserAuthorization(context.auth)?.memberID
    });

    return result.version;
  })
});

export { versionsRouter };
