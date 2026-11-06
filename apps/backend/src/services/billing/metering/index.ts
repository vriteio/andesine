// SPDX-License-Identifier: Elastic-2.0
import { getHistory } from "./get-history";
import { getUsage } from "./get-usage";
import { getUsageTotals } from "./get-usage-totals";
import { recordUsage } from "./record-usage";

const Metering = {
  getHistory,
  getUsage,
  getUsageTotals,
  recordUsage
};

export { Metering };
