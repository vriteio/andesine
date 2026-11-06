import { query } from "@solidjs/router";
import { client } from "#web/lib/api";

// Members and pending invites on the Free plan; the backend enforces it.
const FREE_MEMBER_LIMIT = 3;

const subscriptionQuery = query(() => client.billing.subscription(), "billing-subscription");
// Without a month, reads the current one.
const usageQuery = query((month?: string) => client.billing.usage({ month }), "billing-usage");
const historyQuery = query(() => client.billing.history(), "billing-history");

export { FREE_MEMBER_LIMIT, historyQuery, subscriptionQuery, usageQuery };
