import { id } from "../primitives/id";
import * as z from "zod";

const usageRecordType = z.object({
  id: id().describe("ID of the usage record"),
  workspaceID: id().describe("ID of the workspace"),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  requestCount: z.number().int().min(0)
});
type UsageRecord = z.infer<typeof usageRecordType>;
export { usageRecordType };
export type { UsageRecord };
