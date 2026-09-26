import { toCollectionID, toEntryID } from "#backend/lib/primitives/id";
import type { WebhookResourceScope, WebhookScopeIndex } from "./scope";

interface WebhookEntryContext {
  subject: { kind: "entry"; id: string };
  collectionID: string | null;
  scope: WebhookResourceScope;
}
interface WebhookEntryRow {
  id: string;
  collectionID: string | null;
}

// Accept a database row; expose only public IDs and normalize the workspace root.
const getWebhookEntryContext = (
  index: WebhookScopeIndex,
  entry: WebhookEntryRow
): WebhookEntryContext => {
  const parentID = entry.collectionID ? toCollectionID(entry.collectionID) : null;
  const collectionID = parentID === index.rootID ? null : parentID;
  const scope = index.getCurrentScope(collectionID);

  if (!scope) throw new Error("Entry webhook scope is missing");

  return { subject: { kind: "entry", id: toEntryID(entry.id) }, collectionID, scope };
};

export { getWebhookEntryContext };
