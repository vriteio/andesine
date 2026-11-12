import { posthog } from "posthog-js";
import { type Component, createSignal, onMount, Show } from "solid-js";
import {
  type Consent,
  ConsentBanner,
  readConsent,
  writeConsent
} from "@andesine/components/fragments";
import { links } from "../../links";

const POSTHOG_KEY = import.meta.env.PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.PUBLIC_POSTHOG_HOST;
const COOKIE_DOMAIN = import.meta.env.PUBLIC_COOKIE_DOMAIN;
const SECURE = import.meta.env.PUBLIC_SECURE === "true";
const ANALYTICS_ENABLED = Boolean(POSTHOG_KEY && POSTHOG_HOST);
const PERSISTENCE_KEY = `ph_${POSTHOG_KEY}_posthog`;

// Signed-in users agreed to the privacy policy at registration, as in the app.
const isIdentified = (): boolean => {
  try {
    const persisted = JSON.parse(localStorage.getItem(PERSISTENCE_KEY) ?? "{}");

    return persisted.$user_state === "identified";
  } catch {
    return false;
  }
};
// Without consent, events are cookieless.
const applyConsent = (choice: Consent | null): void => {
  const accepted = choice === "accepted";

  // Each change sends an event, so only changes are applied.
  if (accepted && !posthog.has_opted_in_capturing()) posthog.opt_in_capturing();
  if (!accepted && posthog.has_opted_in_capturing()) posthog.opt_out_capturing();
};

const Analytics: Component = () => {
  const [consent, setConsent] = createSignal<Consent | null | undefined>(undefined);

  const choose = (choice: Consent) => {
    writeConsent(choice, { domain: COOKIE_DOMAIN, secure: SECURE });
    setConsent(choice);
    applyConsent(choice);
  };

  onMount(() => {
    if (!ANALYTICS_ENABLED) return;

    const identified = isIdentified();
    const initialConsent = identified ? "accepted" : readConsent();

    setConsent(initialConsent);
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // The host can be a relay path, e.g. `/relay`; links still open PostHog.
      ui_host: "https://us.posthog.com",
      advanced_disable_feature_flags: true,
      cross_subdomain_cookie: true,
      // Cookieless mode would clear a signed-in user's identity, which the app shares.
      ...(!identified && { cookieless_mode: "on_reject", opt_out_capturing_by_default: true }),
      // A key of its own, so the landing page's consent never changes the app's tracking.
      consent_persistence_name: "andesine_landing_consent",
      session_recording: { maskAllInputs: true }
    });
    applyConsent(initialConsent);
  });

  return (
    <Show when={consent() === null}>
      <ConsentBanner privacyURL={links.legal.privacy} onChoice={choose} />
    </Show>
  );
};

export { Analytics };
