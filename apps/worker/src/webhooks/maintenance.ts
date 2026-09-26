import { cleanupWebhookWorkspace, scanWebhookCleanup } from "@andesine/server/webhooks/cleanup";
import {
  scanWebhookFailureControls,
  maintainWebhookEndpoint,
  type MaintainWebhookEndpointInput
} from "@andesine/server/webhooks/delivery";
import { db } from "../database";
import { publishWebhookUpdate, type PublishEvent } from "./events";

interface WebhookMaintenance {
  stop: () => Promise<void>;
}

const WEBHOOK_MAINTENANCE_INTERVAL_MS = 10_000;
const WEBHOOK_MAINTENANCE_BUDGET = 10;
// Separate from queue scheduling: a Redis wait cannot block failure/key/retention
// maintenance. Page queues are bounded by the database scans (100 each).
const startWebhookMaintenance = (publish: PublishEvent): WebhookMaintenance => {
  let endpoints: MaintainWebhookEndpointInput[] = [];
  let workspaceIDs: string[] = [];
  let endpointCursor: string | null = null;
  let workspaceCursor: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let stopped = false;

  const maintainFailures = async (): Promise<void> => {
    if (!endpoints.length) {
      const page = await scanWebhookFailureControls(db, endpointCursor);

      endpoints = page.endpoints;
      endpointCursor = page.cursor;
    }

    const count = Math.min(WEBHOOK_MAINTENANCE_BUDGET, endpoints.length);

    for (let index = 0; index < count; index++) {
      if (stopped) return;

      const endpoint = endpoints.shift()!;

      try {
        const result = await maintainWebhookEndpoint(db, endpoint);

        if (result.disabled) {
          publishWebhookUpdate(publish, endpoint.workspaceID, endpoint.endpointID);
        }

        // Continue long histories at the tail, at most once per tick. Busy rows
        // are rediscovered on the next scan pass so they cannot pin this page.
        if (result.acquired && result.cursor) {
          endpoints.push({ ...endpoint, afterRunID: result.cursor });
        }
      } catch {
        console.error("Webhook failure maintenance failed", { endpointID: endpoint.endpointID });
      }
    }
  };
  const cleanup = async (): Promise<void> => {
    if (!workspaceIDs.length) {
      const page = await scanWebhookCleanup(db, workspaceCursor);

      workspaceIDs = page.workspaceIDs;
      workspaceCursor = page.cursor;
    }

    const count = Math.min(WEBHOOK_MAINTENANCE_BUDGET, workspaceIDs.length);

    for (let index = 0; index < count; index++) {
      if (stopped) return;

      const workspaceID = workspaceIDs.shift()!;

      try {
        // One batch per workspace per pass, including when result.more is true.
        // A large history must not prevent other workspaces from being visited.
        await cleanupWebhookWorkspace(db, workspaceID);
      } catch {
        console.error("Webhook cleanup failed", { workspaceID });
      }
    }
  };
  const tick = (): void => {
    running = Promise.allSettled([maintainFailures(), cleanup()])
      .then((results) => {
        for (const result of results) {
          if (result.status === "rejected") console.error("Webhook maintenance scan failed");
        }
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, WEBHOOK_MAINTENANCE_INTERVAL_MS);
      });
  };
  const stop = async (): Promise<void> => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };

  tick();
  return { stop };
};

export { startWebhookMaintenance };
