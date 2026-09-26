import { toCollectionID, toEntryID } from "@andesine/contracts/primitives";
import type { WebhookResourceScope, WebhookScopeIndex } from "../scope";
import { createOutboundEvent, type WebhookEventData, type WebhookOperation } from "../operation";
import type { WebhookEventChange } from "../recording-context";
import type { WebhookStructureRow } from "./state";

interface WebhookStructureContext {
  parentID: string | null;
  scope: WebhookResourceScope;
}
interface WebhookStructureChangeInput {
  before?: WebhookStructureRow;
  after: WebhookStructureRow;
  beforeIndex: WebhookScopeIndex;
  afterIndex: WebhookScopeIndex;
  operation: WebhookOperation;
  occurredAt: Date;
}

const getStructureContext = (
  row: WebhookStructureRow,
  index: WebhookScopeIndex
): WebhookStructureContext => {
  const parentID = row.parentID ? toCollectionID(row.parentID) : null;
  const scope = index.getCurrentScope(
    row.kind === "collection" ? toCollectionID(row.id) : parentID
  );

  if (!scope) throw new Error("Webhook structure scope is missing");

  return { parentID: parentID === index.rootID ? null : parentID, scope };
};
const getWebhookStructureChanges = (input: WebhookStructureChangeInput): WebhookEventChange[] => {
  const { before, after, operation, occurredAt } = input;
  const changes: WebhookEventChange[] = [];
  const previous = before ? getStructureContext(before, input.beforeIndex) : null;
  const current = getStructureContext(after, input.afterIndex);
  const collectionSubject = { kind: "collection", id: toCollectionID(after.id) } as const;
  const entrySubject = { kind: "entry", id: toEntryID(after.id) } as const;
  const subject = after.kind === "collection" ? collectionSubject : entrySubject;
  const resources = [{ ...subject, before: previous?.scope ?? null, after: current.scope }];
  const add = (key: string, data: WebhookEventData): void => {
    changes.push({
      event: createOutboundEvent(operation, `structure-${key}`, data, occurredAt),
      resources
    });
  };

  if (after.deletedAt) {
    if (!before || before.deletedAt) return changes;

    const deletedAt = after.deletedAt.toISOString();

    add(
      "deleted",
      after.kind === "collection"
        ? {
            type: "collection.deleted",
            subject: collectionSubject,
            data: { name: before.name, parentID: previous!.parentID, deletedAt }
          }
        : {
            type: "entry.deleted",
            subject: entrySubject,
            data: { name: before.name, collectionID: previous!.parentID, deletedAt }
          }
    );
    return changes;
  }

  if (!before || before.deletedAt) {
    const type = before ? "restored" : "created";

    add(
      type,
      after.kind === "collection"
        ? {
            type: before ? "collection.restored" : "collection.created",
            subject: collectionSubject,
            data: { name: after.name, parentID: current.parentID }
          }
        : {
            type: before ? "entry.restored" : "entry.created",
            subject: entrySubject,
            data: { name: after.name, collectionID: current.parentID }
          }
    );
    return changes;
  }

  const fields: Array<"name" | "restricted" | "publishingEnabled"> = [];
  const ancestryChanged =
    previous!.scope.ancestry.map(({ id }) => id).join("/") !==
    current.scope.ancestry.map(({ id }) => id).join("/");
  const parentChanged = previous!.parentID !== current.parentID;

  if (before.name !== after.name) fields.push("name");
  if (after.kind === "collection" && before.restricted !== after.restricted) {
    fields.push("restricted");
  }

  if (after.kind === "collection" && before.publishingEnabled !== after.publishingEnabled) {
    fields.push("publishingEnabled");
  }

  if (fields.length) {
    add(
      "updated",
      after.kind === "collection"
        ? {
            type: "collection.updated",
            subject: collectionSubject,
            data: { parentID: current.parentID, changedFields: fields }
          }
        : {
            type: "entry.updated",
            subject: entrySubject,
            data: { collectionID: current.parentID, changedFields: ["name"] }
          }
    );
  }

  if (parentChanged || ancestryChanged || before.rank !== after.rank) {
    const data = {
      scopeTransition: "within" as const,
      reason: parentChanged
        ? ("direct" as const)
        : ancestryChanged
          ? ("ancestor_moved" as const)
          : ("reordered" as const),
      from: { visibility: "visible" as const, parentID: previous!.parentID, order: before.rank },
      to: { visibility: "visible" as const, parentID: current.parentID, order: after.rank }
    };

    add(
      "moved",
      after.kind === "collection"
        ? { type: "collection.moved", subject: collectionSubject, data }
        : { type: "entry.moved", subject: entrySubject, data }
    );
  }

  return changes;
};

export { getWebhookStructureChanges };
