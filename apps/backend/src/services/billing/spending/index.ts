// SPDX-License-Identifier: Elastic-2.0
import { sendSpendingAlerts } from "./send-alerts";
import { updateSpendingLimit } from "./update-limit";

const Spending = {
  sendAlerts: sendSpendingAlerts,
  updateLimit: updateSpendingLimit
};

export { Spending };
