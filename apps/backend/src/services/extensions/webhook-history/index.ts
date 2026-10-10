import { getDelivery } from "./get-delivery";
import { listAttempts } from "./list-attempts";
import { listDeliveries } from "./list-deliveries";
import { listRuns } from "./list-runs";

const webhookHistory = { listDeliveries, getDelivery, listRuns, listAttempts };

export { webhookHistory };
