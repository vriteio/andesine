// SPDX-License-Identifier: Elastic-2.0
import { getUsage } from "./get-usage";
import { getUsageTotals } from "./get-usage-totals";
import { recordUsage } from "./record-usage";

const Metering = {
  getUsage,
  getUsageTotals,
  recordUsage
};

export { Metering };
