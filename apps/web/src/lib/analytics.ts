import type { PostHog } from "posthog-js";
import { createSignal } from "solid-js";
import { type Consent, readConsent } from "@andesine/components";
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

const loadClient = (): Promise<PostHog> | null => {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return null;

  client ??= import("posthog-js").then(({ posthog }) => {
    posthog.init(config.PUBLIC_POSTHOG_KEY!, {
      api_host: config.PUBLIC_POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      rageclick: false,
      capture_dead_clicks: false,
      enable_heatmaps: false,
      advanced_disable_feature_flags: true,
      cross_subdomain_cookie: true,
      cookieless_mode: "on_reject",
      mask_personal_data_properties: true,
      custom_personal_data_properties: ["signature", "sig", "user_code"],
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".ProseMirror"
      },
      before_send: (event) => {
        CONTENT_PROPERTIES.forEach((property) => delete event?.properties[property]);

        return event;
      }
    });

    return posthog;
  });

  return client;
};
const applyConsent = (posthog: PostHog, choice: Consent): void => {
  const accepted = choice === "accepted";

  // Each opt-in call sends a `$opt_in` event, so only changes are applied.
  if (accepted && !posthog.has_opted_in_capturing()) posthog.opt_in_capturing();
  if (!accepted && !posthog.has_opted_out_capturing()) posthog.opt_out_capturing();
};
const initAnalytics = (): void => {
  const storedConsent = readConsent();

  void loadClient()?.then((posthog) => {
    // An identified user stays opted in until sign-out; opting in again would reset the session.
    if (!posthog.get_property("$user_id")) applyConsent(posthog, storedConsent ?? "declined");
  });
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
    applyConsent(posthog, readConsent() ?? "declined");
  });
};

export {
  captureEvent,
  capturePageview,
  identifiedWorkspaceID,
  identifyAnalytics,
  initAnalytics,
  resetAnalytics
};
