import { workspaceType } from "../entities/workspaces";
import { id } from "../primitives/id";
import * as z from "zod";

const workspaceSummaryEventType = workspaceType.pick({
  id: true,
  name: true,
  subscriptionPlan: true
});
const workspaceStateEventType = z.union([
  z.object({
    action: z.literal("workspace:create"),
    memberID: id().optional(),
    data: workspaceSummaryEventType
  }),
  z.object({
    action: z.literal("workspace:update"),
    memberID: id().optional(),
    data: z.object({
      ...workspaceSummaryEventType.pick({ id: true }).shape,
      ...workspaceSummaryEventType.omit({ id: true }).partial().shape
    })
  }),
  z.object({
    action: z.literal("workspace:delete"),
    memberID: id().optional(),
    data: z.object({
      id: workspaceSummaryEventType.shape.id,
      entryIDs: z.array(id())
    })
  })
]);
type WorkspaceStateEvent = z.infer<typeof workspaceStateEventType>;
export { workspaceStateEventType };
export type { WorkspaceStateEvent };
