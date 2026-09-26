import { id } from "../primitives/id";
import * as z from "zod";

const workspaceType = z.object({
  id: id().describe("ID of the workspace"),
  name: z.string().min(1).max(50).describe("Name of the workspace"),
  logo: z.string().optional().describe("Public workspace logo URL"),
  customerID: z.string().optional().describe("Stripe customer ID"),
  subscriptionStatus: z.string().optional().describe("Subscription status"),
  subscriptionPlan: z.string().optional().describe("Subscription plan"),
  subscriptionData: z.string().optional().describe("JSON-stringified subscription data"),
  subscriptionExpiresAt: z.iso.datetime().optional().describe("Billing cycle expiration")
});
type Workspace = z.infer<typeof workspaceType>;
export { workspaceType };
export type { Workspace };
