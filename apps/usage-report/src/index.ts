// SPDX-License-Identifier: Elastic-2.0
import { pool } from "./database";
import { reportUsage } from "./report-usage";

try {
  const reportedCount = await reportUsage();

  console.log(`Stripe usage reporting completed (${reportedCount} ledger rows processed)`);
} catch (error) {
  console.error("Stripe usage reporting failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
