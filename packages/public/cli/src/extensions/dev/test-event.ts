import type { ExtensionWebhookDeliveryDetails } from "@andesine/contracts/extensions";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { CommandContext } from "../../context";
import { CLIError } from "../../errors";
import { createDevelopmentClient } from "./client";
import { readDevelopmentState } from "./state";

const POLL_INTERVAL = 1000;
const POLL_LIMIT = 30;

const describeAttempt = ({ delivery }: ExtensionWebhookDeliveryDetails): string => {
  const result = delivery.lastHTTPStatus
    ? `HTTP ${delivery.lastHTTPStatus}`
    : (delivery.lastFailureCategory ?? "no response");

  return `${delivery.attemptCount} attempt(s), last: ${result}`;
};
/** Waits for the first attempt to finish, or the delivery to end. */
const waitForResult = async (
  context: CommandContext,
  read: () => Promise<ExtensionWebhookDeliveryDetails>
): Promise<ExtensionWebhookDeliveryDetails> => {
  let details = await read();

  for (let poll = 0; poll < POLL_LIMIT; poll += 1) {
    const { state, attemptCount } = details.delivery;
    const isWaiting = state === "in_flight" || (state === "pending" && attemptCount === 0);

    if (!isWaiting) return details;

    await sleep(POLL_INTERVAL, undefined, { signal: context.signal });
    details = await read();
  }

  return details;
};

/** Sends a sample event to a webhook of the development extension and reports the result. */
const sendTestEvent = async (
  context: CommandContext,
  options: { root: string; webhookID: string; type: string }
): Promise<void> => {
  const root = path.resolve(options.root);
  const client = createDevelopmentClient(context);
  const { extensionID } = await readDevelopmentState(root, context);
  const { deliveryID } = await client.sendTest(extensionID, options.webhookID, options.type);
  const details = await context.output.progress(
    `Sending ${options.type} to ${options.webhookID}`,
    () => {
      return waitForResult(context, () => {
        return client.getDelivery(extensionID, options.webhookID, deliveryID);
      });
    },
    "Delivery attempted"
  );
  const { state, nextAttemptAt } = details.delivery;
  const retry = nextAttemptAt ? `; next attempt at ${nextAttemptAt}` : "";

  if (state !== "succeeded") {
    throw new CLIError(`Not delivered: ${state}, ${describeAttempt(details)}${retry}.`);
  }

  await context.output.success(`Delivered (${describeAttempt(details)}).`);
};

export { sendTestEvent };
