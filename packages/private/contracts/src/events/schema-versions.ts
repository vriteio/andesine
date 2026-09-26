import { schemaVersionSummaryType } from "../schema/data";
import { id } from "../primitives/id";
import * as z from "zod";

const schemaVersionEventType = z.union([
  z.object({
    action: z.literal("schema-version:create"),
    memberID: id().optional(),
    data: z.lazy(() => schemaVersionSummaryType)
  }),
  z.object({
    action: z.literal("schema-version:update"),
    memberID: id().optional(),
    data: z.lazy(() => schemaVersionSummaryType)
  })
]);
type SchemaVersionEvent = z.infer<typeof schemaVersionEventType>;
export { schemaVersionEventType };
export type { SchemaVersionEvent };
