import { keyType } from "../entities/keys";
import { id } from "../primitives/id";
import * as z from "zod";

const keyEventType = z.union([
  z.object({
    action: z.literal("key:create"),
    memberID: id().optional(),
    data: keyType
  }),
  z.object({
    action: z.literal("key:update"),
    memberID: id().optional(),
    data: z.object({
      ...keyType.pick({ id: true }).shape,
      ...keyType.omit({ id: true }).partial().shape
    })
  }),
  z.object({
    action: z.literal("key:delete"),
    memberID: id().optional(),
    data: z.object({ ids: z.array(keyType.shape.id) })
  }),
  z.object({
    action: z.literal("key:rotate"),
    memberID: id().optional(),
    data: z.object({
      previousKeyID: keyType.shape.id,
      key: keyType
    })
  })
]);
type KeyEvent = z.infer<typeof keyEventType>;
export { keyEventType };
export type { KeyEvent };
