import { posthog } from "posthog-js";
import { type Component, onMount } from "solid-js";

const POSTHOG_KEY = import.meta.env.PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.PUBLIC_POSTHOG_HOST;
const ANALYTICS_ENABLED = Boolean(POSTHOG_KEY && POSTHOG_HOST);

const Analytics: Component = () => {
  onMount(() => {
    if (!ANALYTICS_ENABLED) return;

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // The host can be a relay path, e.g. `/relay`; links still open PostHog.
      ui_host: "https://us.posthog.com",
      advanced_disable_feature_flags: true,
      cross_subdomain_cookie: true,
      session_recording: { maskAllInputs: true }
    });

    // shortcut: consent banner is off while capture is debugged; restore it before release.
    if (!posthog.has_opted_in_capturing()) posthog.opt_in_capturing();
  });

  return null;
};

export { Analytics };
