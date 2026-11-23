import { commentThreadType } from "../entities/comments";
import { id } from "../primitives/id";
import * as z from "zod";

const commentThreadEventType = z.union([
  z.object({
    action: z.literal("comment-thread:update"),
    memberID: id().optional(),
    data: commentThreadType
  }),
  z.object({
    action: z.literal("comment-thread:delete"),
    memberID: id().optional(),
    data: z.object({ id: id(), entryID: id() })
  })
]);
type CommentThreadEvent = z.infer<typeof commentThreadEventType>;
export { commentThreadEventType };
export type { CommentThreadEvent };
