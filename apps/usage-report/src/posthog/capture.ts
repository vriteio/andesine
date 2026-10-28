// SPDX-License-Identifier: Elastic-2.0
import { config } from "../config";

interface PostHogEvent {
  event: string;
  distinct_id: string;
  uuid: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

const REQUEST_TIMEOUT_MS = 30_000;

const captureBatch = async (batch: PostHogEvent[]): Promise<void> => {
  const response = await fetch(`${config.POSTHOG_HOST!.replace(/\/+$/, "")}/batch/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.PUBLIC_POSTHOG_KEY, batch }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`PostHog batch failed (${response.status}): ${await response.text()}`);
  }
};

export { captureBatch };
export type { PostHogEvent };
