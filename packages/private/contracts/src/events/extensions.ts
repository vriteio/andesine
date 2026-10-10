import { id, publicID } from "../primitives/id";
import * as z from "zod";

// UI refresh signals only: an extension was installed, changed, or uninstalled.
const extensionEventType = z.object({
  action: z.enum(["extension:create", "extension:update", "extension:delete"]),
  memberID: id().optional(),
  data: z.object({ id: publicID("ext") })
});
type ExtensionEvent = z.infer<typeof extensionEventType>;

export { extensionEventType };
export type { ExtensionEvent };
