import { PostHog } from "posthog-node";
import { config } from "#backend/lib/config";
import { getUserAuthorization, type SessionData } from "#backend/lib/policy";

interface CaptureInput {
  userID?: string;
  workspaceID?: string;
  properties?: AnalyticsProperties;
}

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const SHUTDOWN_TIMEOUT_MS = 3000;

const client =
  config.PUBLIC_POSTHOG_KEY && config.POSTHOG_HOST
    ? new PostHog(config.PUBLIC_POSTHOG_KEY, { host: config.POSTHOG_HOST })
    : null;

/** Sends an event for a user, or for the workspace alone (e.g. API keys); never sends content. */
const capture = (event: string, input: CaptureInput): void => {
  const distinctID = input.userID ?? input.workspaceID;

  if (!client || !distinctID) return;

  client.capture({
    distinctId: distinctID,
    event,
    properties: { ...input.properties, ...(!input.userID && { $process_person_profile: false }) },
    ...(input.workspaceID && { groups: { workspace: input.workspaceID } })
  });
};
const trackEvent = (event: string, auth: SessionData, properties?: AnalyticsProperties): void => {
  capture(event, {
    userID: getUserAuthorization(auth)?.userID || undefined,
    workspaceID: auth.workspaceID || undefined,
    properties: { ...properties, source: auth.type }
  });
};
const shutdownAnalytics = async (): Promise<void> => {
  await client?.shutdown(SHUTDOWN_TIMEOUT_MS);
};

export { capture, shutdownAnalytics, trackEvent };
