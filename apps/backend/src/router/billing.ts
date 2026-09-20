// SPDX-License-Identifier: Elastic-2.0
// License terms: apps/backend/src/services/billing/LICENSE
import { config } from "#backend/lib/config";
import { authorized } from "#backend/lib/transport";
import { Billing } from "#backend/services/billing";
import { api } from "./implement";

const handlers = api.billing;
const authorizedHandlers = handlers.use(authorized);
const billingRouter = handlers.router({
  subscription: authorizedHandlers.subscription.handler(async ({ context }) => {
    return Billing.getSubscription({
      workspaceID: context.auth.workspaceID
    });
  }),
  usage: authorizedHandlers.usage.handler(async ({ context }) => {
    const subscription = await Billing.getSubscription({
      workspaceID: context.auth.workspaceID
    });

    return Billing.Metering.getUsage({
      workspaceID: context.auth.workspaceID,
      plan: subscription.plan
    });
  }),
  checkout: authorizedHandlers.checkout.handler(async ({ context }) => {
    return Billing.createCheckout({
      workspaceID: context.auth.workspaceID,
      successURL: `${config.PUBLIC_APP_URL}/${context.auth.workspaceID}/settings/billing?billing=success`,
      cancelURL: `${config.PUBLIC_APP_URL}/${context.auth.workspaceID}/settings/billing?billing=cancel`
    });
  }),
  portal: authorizedHandlers.portal.handler(async ({ context }) => {
    return Billing.createPortal({
      workspaceID: context.auth.workspaceID,
      returnURL: `${config.PUBLIC_APP_URL}/${context.auth.workspaceID}/settings/billing?billing=portal`
    });
  })
});

export { billingRouter };
