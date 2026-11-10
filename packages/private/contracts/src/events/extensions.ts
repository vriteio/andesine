import { id, publicID } from "../primitives/id";
import { extensionStorageKeyType } from "../extensions/storage";
import * as z from "zod";

// UI refresh signals only: an extension was installed, changed, or uninstalled, or a storage key
// of it was set or deleted, e.g. by its backend; members can list the keys anyway.
const extensionEventType = z.union([
  z.object({
    action: z.enum(["extension:create", "extension:update", "extension:delete"]),
    memberID: id().optional(),
    data: z.object({ id: publicID("ext") })
  }),
  z.object({
    action: z.literal("extension:storage"),
    memberID: id().optional(),
    data: z.object({ id: publicID("ext"), key: extensionStorageKeyType, exists: z.boolean() })
  })
]);
type ExtensionEvent = z.infer<typeof extensionEventType>;

export { extensionEventType };
export type { ExtensionEvent };
