// SPDX-License-Identifier: Elastic-2.0
import { memberships, roles, users, workspaces } from "@andesine/server/database";
import { toUsageDate } from "#backend/lib/billing";
import { config } from "#backend/lib/config";
import { toUUID } from "@andesine/contracts/primitives";
import { db, redis, sendEmail } from "#backend/lib/adapters";
import { and, arrayContains, eq, or } from "drizzle-orm";

interface SpendingAlertInput {
  workspaceID: string;
  /** In cents. */
  estimatedSpend: number;
  spendingLimit: number;
  currency: string;
}

const ALERT_THRESHOLDS = [100, 80];
const MAX_HANDLED_ALERTS = 10_000;

// Lets most calls skip Redis.
const handledAlerts = new Set<string>();

const formatAmount = (cents: number, currency: string): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
};
const getRecipients = async (workspaceUUID: string) => {
  return db
    .select({ email: users.email, workspaceName: workspaces.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userID))
    .innerJoin(roles, eq(roles.id, memberships.roleID))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceID))
    .where(
      and(
        eq(memberships.workspaceID, workspaceUUID),
        or(eq(roles.baseRole, "admin"), arrayContains(roles.permissions, ["billing"]))
      )
    );
};

const sendSpendingAlerts = async (input: SpendingAlertInput): Promise<void> => {
  const workspaceUUID = toUUID(input.workspaceID);
  const percent = (input.estimatedSpend / input.spendingLimit) * 100;
  const threshold = ALERT_THRESHOLDS.find((value) => percent >= value);
  const month = toUsageDate(new Date()).slice(0, 7);
  const key = `spending-alert:${workspaceUUID}:${month}:${input.spendingLimit}:${threshold}`;

  if (!threshold || handledAlerts.has(key)) return;

  if (handledAlerts.size >= MAX_HANDLED_ALERTS) handledAlerts.clear();

  handledAlerts.add(key);

  let recipients: Awaited<ReturnType<typeof getRecipients>>;

  try {
    const isFirst = await redis.set(key, "1", { NX: true, EX: 40 * 86_400 });

    if (isFirst !== "OK") return;

    recipients = await getRecipients(workspaceUUID);
  } catch (error) {
    // Lets a later request send the alert again.
    handledAlerts.delete(key);
    await redis.del(key).catch(() => undefined);
    throw error;
  }

  const billingLink = `${config.PUBLIC_APP_URL}/${input.workspaceID}/settings/billing`;
  // Failed emails are not sent again, to not duplicate the sent ones.
  const results = await Promise.allSettled(
    recipients.map(({ email, workspaceName }) => {
      return sendEmail(email, "spending-alert", {
        workspaceName,
        threshold,
        spendingLimit: formatAmount(input.spendingLimit, input.currency),
        estimatedSpend: formatAmount(input.estimatedSpend, input.currency),
        billingLink
      });
    })
  );
  const errors = results.flatMap((result) => {
    return result.status === "rejected" ? [result.reason as unknown] : [];
  });

  if (errors.length) {
    console.error("Failed to send spending alerts", { errors, workspaceID: input.workspaceID });
  }
};

export { sendSpendingAlerts };
