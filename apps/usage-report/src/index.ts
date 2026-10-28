// SPDX-License-Identifier: Elastic-2.0
import { pool } from "./database";
import { reportPostHogUsage } from "./posthog/report-usage";
import { reportStripeUsage } from "./stripe/report-usage";

interface UsageReporter {
  name: string;
  unit: string;
  report: () => Promise<number | null>;
}

const reporters: UsageReporter[] = [
  { name: "Stripe", unit: "ledger rows processed", report: reportStripeUsage },
  { name: "PostHog", unit: "daily usage events sent", report: reportPostHogUsage }
];

const results = await Promise.allSettled(reporters.map((reporter) => reporter.report()));

results.forEach((result, index) => {
  const { name, unit } = reporters[index];

  if (result.status === "rejected") {
    console.error(`${name} usage reporting failed:`, result.reason);
    process.exitCode = 1;
  } else if (result.value === null) {
    console.log(`${name} usage reporting skipped (not configured)`);
  } else {
    console.log(`${name} usage reporting completed (${result.value} ${unit})`);
  }
});

await pool.end();
