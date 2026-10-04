// SPDX-License-Identifier: Elastic-2.0
import { workspaces } from "@andesine/server/database";
import { dropUsageCounters, getUsageCounterKey } from "#backend/lib/billing";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { eq } from "drizzle-orm";

const updateSpendingLimit = async (input: {
  workspaceID: string;
  spendingLimit: number | null;
}): Promise<void> => {
  const workspaceUUID = toUUID(input.workspaceID);

  await db
    .update(workspaces)
    .set({ spendingLimit: input.spendingLimit, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceUUID));
  // The counters cache the limit.
  await dropUsageCounters(getUsageCounterKey(workspaceUUID, new Date()));
};

export { updateSpendingLimit };
