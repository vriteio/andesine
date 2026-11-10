import { id } from "../primitives/id";
import * as z from "zod";

const schemaEventDataType = z.object({
  id: id(),
  collectionID: id(),
  enabled: z.boolean(),
  hasActiveVersion: z.boolean(),
  hasUnappliedChanges: z.boolean()
});
const schemaEventType = z.union([
  z.object({
    action: z.literal("schema:create"),
    memberID: id().optional(),
    data: schemaEventDataType
  }),
  z.object({
    action: z.literal("schema:update"),
    memberID: id().optional(),
    data: schemaEventDataType
  }),
  z.object({
    action: z.literal("schema:delete"),
    memberID: id().optional(),
    data: schemaEventDataType
  }),
  z.object({
    action: z.literal("schema:content-reset"),
    data: schemaEventDataType
  })
]);
type SchemaEvent = z.infer<typeof schemaEventType>;
export { schemaEventType };
export type { SchemaEvent };
