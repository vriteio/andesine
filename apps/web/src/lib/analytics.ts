import { type PostHog, posthog } from "posthog-js";
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

let capturePaused = false;

const loadClient = (): PostHog | null => {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return null;

  if (!posthog.__loaded) {
    posthog.init(config.PUBLIC_POSTHOG_KEY!, {
      api_host: config.PUBLIC_POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      // Pageviews are captured by hand, once the workspace is known.
      capture_pageview: false,
      capture_pageleave: true,
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

    // shortcut: consent banner is off while capture is debugged; restore it before release.
    if (!posthog.has_opted_in_capturing()) posthog.opt_in_capturing();
  }

  return posthog;
};
const initAnalytics = (): void => {
  loadClient();
};
const capturePageview = (): void => {
  loadClient()?.capture("$pageview");
};
const captureEvent = (event: string, properties?: Record<string, string>): void => {
  loadClient()?.capture(event, properties);
};
/** Signed-in users agreed to the privacy policy at registration, so capture is full. */
const identifyAnalytics = (user: AnalyticsUser, workspace: AnalyticsWorkspace): void => {
  const client = loadClient();

  if (!client) return;

  const previousUserID = client.get_property("$user_id");
  const switchedAccount = Boolean(previousUserID) && previousUserID !== user.id;

  if (switchedAccount) client.reset();
  if (!client.has_opted_in_capturing()) client.opt_in_capturing();

  client.identify(user.id, { name: user.name, email: user.email });
  client.group("workspace", workspace.id, { name: workspace.name });
  setIdentifiedWorkspaceID(workspace.id);
};
const resetAnalytics = (): void => {
  const client = loadClient();

  if (!client?.get_property("$user_id")) return;

  client.reset();
  setIdentifiedWorkspaceID(null);
};
/** Drops events without changing the identity or consent; the result resumes capture. */
const pauseAnalytics = (): (() => void) => {
  const client = loadClient();
  const recording = Boolean(client?.sessionRecordingStarted());

  capturePaused = true;
  client?.stopSessionRecording();

  return () => {
    capturePaused = false;

    if (recording) client?.startSessionRecording();
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
