import { workspaces } from "@andesine/server/database";
// SPDX-License-Identifier: Elastic-2.0
import { countMembers, FREE_MEMBER_LIMIT } from "#backend/lib/billing";
import { toUUID } from "@andesine/contracts/primitives";
import { db, stripe } from "#backend/lib/adapters";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

const NO_CANCEL_CONFIGURATION_KEY = "andesine_no_cancel";

let noCancelConfiguration: Promise<string> | null = null;

/** A portal without cancellation, for workspaces with more members than Free allows. */
const getNoCancelConfiguration = (client: NonNullable<typeof stripe>): Promise<string> => {
  noCancelConfiguration ??= (async () => {
    for await (const configuration of client.billingPortal.configurations.list({ active: true })) {
      if (configuration.metadata?.[NO_CANCEL_CONFIGURATION_KEY]) return configuration.id;
    }

    const configuration = await client.billingPortal.configurations.create({
      metadata: { [NO_CANCEL_CONFIGURATION_KEY]: "true" },
      features: {
        customer_update: { enabled: true, allowed_updates: ["email", "name", "address", "tax_id"] },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: false }
      }
    });

    return configuration.id;
  })().catch((error: unknown) => {
    noCancelConfiguration = null;
    throw error;
  });

  return noCancelConfiguration;
};

const createPortal = async (input: {
  workspaceID: string;
  returnURL: string;
}): Promise<{ url: string }> => {
  if (!stripe) {
    throw new ORPCError("FORBIDDEN", { message: "Billing is disabled for this installation" });
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, toUUID(input.workspaceID)))
    .limit(1);

  if (!workspace) throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
  if (workspace.deletingAt) {
    throw new ORPCError("CONFLICT", { message: "Workspace deletion is in progress" });
  }

  if (!workspace.customerID) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Workspace has no billing account",
      data: { hints: ["Start a subscription checkout before opening the billing portal."] }
    });
  }

  const members = await countMembers(db, workspace.id);
  const blocksCancel = workspace.subscriptionPlan === "pro" && members > FREE_MEMBER_LIMIT;
  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.customerID,
    return_url: input.returnURL,
    configuration: blocksCancel ? await getNoCancelConfiguration(stripe) : undefined
  });

  return { url: session.url };
};

export { createPortal };
