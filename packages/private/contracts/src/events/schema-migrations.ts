import { schemaMigrationStatusType } from "../schema/data";
import { id } from "../primitives/id";
import * as z from "zod";

const schemaMigrationEventType = z.object({
  action: z.literal("schema-migration:update"),
  data: z.object({
    id: id(),
    schemaID: id().nullable(),
    collectionIDs: z.array(id()),
    moveSourceCollectionID: id().nullable(),
    status: z.lazy(() => schemaMigrationStatusType),
    totalEntries: z.number().int().nonnegative(),
    processedEntries: z.number().int().nonnegative()
  })
});
type SchemaMigrationEvent = z.infer<typeof schemaMigrationEventType>;
export { schemaMigrationEventType };
export type { SchemaMigrationEvent };
