import type { PostHog } from "posthog-js";
import { createSignal } from "solid-js";
import { config } from "#web/lib/api";

interface AnalyticsUser {
  id: string;
  name: string;
  email: string;
}
interface AnalyticsWorkspace {
  id: string;
  name: string;
}

const ANALYTICS_ENABLED = Boolean(config.PUBLIC_POSTHOG_KEY && config.PUBLIC_POSTHOG_HOST);
// Page titles hold entry names; events keep IDs only.
const CONTENT_PROPERTIES = ["title", "$title"];

const [identifiedWorkspaceID, setIdentifiedWorkspaceID] = createSignal<string | null>(null);

let client: Promise<PostHog> | null = null;
let capturePaused = false;

const loadClient = (): Promise<PostHog> | null => {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return null;

  client ??= import("posthog-js").then(({ posthog }) => {
    posthog.init(config.PUBLIC_POSTHOG_KEY!, {
      api_host: config.PUBLIC_POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      capture_heatmaps: true,
      advanced_disable_feature_flags: true,
      cross_subdomain_cookie: true,
      mask_personal_data_properties: true,
      custom_personal_data_properties: ["signature", "sig", "user_code"],
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".ProseMirror"
      },
      before_send: (event) => {
        if (capturePaused) return null;

        CONTENT_PROPERTIES.forEach((property) => delete event?.properties[property]);

        return event;
      }
    });

    return posthog;
  });

  return client;
};
const initAnalytics = (): void => {
  void loadClient();
};
const capturePageview = (): void => {
  void loadClient()?.then((posthog) => posthog.capture("$pageview"));
};
const captureEvent = (event: string, properties?: Record<string, string>): void => {
  void loadClient()?.then((posthog) => posthog.capture(event, properties));
};
/** Signed-in users agreed to the privacy policy at registration, so capture is full. */
const identifyAnalytics = (user: AnalyticsUser, workspace: AnalyticsWorkspace): void => {
  void loadClient()?.then((posthog) => {
    const previousUserID = posthog.get_property("$user_id");
    const switchedAccount = Boolean(previousUserID) && previousUserID !== user.id;

    if (switchedAccount) posthog.reset();
    if (!posthog.has_opted_in_capturing()) posthog.opt_in_capturing();

    posthog.identify(user.id, { name: user.name, email: user.email });
    posthog.group("workspace", workspace.id, { name: workspace.name });
    setIdentifiedWorkspaceID(workspace.id);
  });
};
const resetAnalytics = (): void => {
  void loadClient()?.then((posthog) => {
    if (!posthog.get_property("$user_id")) return;

    posthog.reset();
    setIdentifiedWorkspaceID(null);
  });
};
/** Drops events without changing the identity or consent; the result resumes capture. */
const pauseAnalytics = async (): Promise<() => void> => {
  const posthog = await loadClient();
  const recording = Boolean(posthog?.sessionRecordingStarted());

  capturePaused = true;
  posthog?.stopSessionRecording();

  return () => {
    capturePaused = false;

    if (recording) posthog?.startSessionRecording();
  };
};

export {
  captureEvent,
  capturePageview,
  identifiedWorkspaceID,
  identifyAnalytics,
  initAnalytics,
  pauseAnalytics,
  resetAnalytics
};
