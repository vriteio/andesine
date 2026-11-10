import { entryEventType } from "./entries";
import { groupEventType } from "./groups";
import { keyEventType } from "./keys";
import { membershipEventType } from "./memberships";
import { collectionEventType } from "./collections";
import { roleEventType } from "./roles";
import { schemaVersionEventType } from "./schema-versions";
import { schemaMigrationEventType } from "./schema-migrations";
import { schemaEventType } from "./schemas";
import { publishingEventType } from "./publishing";
import { versionEventType } from "./versions";
import { webhookEventType } from "./webhooks";
import { extensionEventType } from "./extensions";
import { workspaceStateEventType } from "./workspaces";
import * as z from "zod";

const workspaceEventType = z.union([
  entryEventType,
  collectionEventType,
  groupEventType,
  membershipEventType,
  roleEventType,
  schemaVersionEventType,
  schemaMigrationEventType,
  schemaEventType,
  publishingEventType,
  versionEventType,
  keyEventType,
  webhookEventType,
  extensionEventType,
  workspaceStateEventType
]);
const workspaceSettingsEventType = z.union([
  groupEventType,
  membershipEventType,
  roleEventType,
  keyEventType,
  webhookEventType,
  extensionEventType,
  workspaceStateEventType
]);
type WorkspaceEvent = z.infer<typeof workspaceEventType>;
type WorkspaceSettingsEvent = z.infer<typeof workspaceSettingsEventType>;
export { workspaceEventType, workspaceSettingsEventType };
export type { WorkspaceEvent, WorkspaceSettingsEvent };
