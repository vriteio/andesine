import { versionSummaryType } from "../versions/index";
import { id } from "../primitives/id";
import * as z from "zod";

const versionEventType = z.union([
  z.object({
    action: z.literal("version:create"),
    memberID: id().optional(),
    data: versionSummaryType
  }),
  z.object({
    action: z.literal("version:update"),
    memberID: id().optional(),
    data: versionSummaryType
  }),
  z.object({
    action: z.literal("version:delete"),
    memberID: id().optional(),
    data: z.object({
      entryIDsByVersionID: z.record(id(), id()),
      ids: z.array(id())
    })
  })
]);
type VersionEvent = z.infer<typeof versionEventType>;
export { versionEventType };
export type { VersionEvent };
