import type { PostHog } from "posthog-js";
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

const Analytics: Component = () => {
  const [consent, setConsent] = createSignal<Consent | null | undefined>(undefined);

  let client: Promise<PostHog> | null = null;

  const loadClient = () => {
    client ??= import("posthog-js").then(({ posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // The host can be a relay path, e.g. `/relay`; links still open PostHog.
        ui_host: "https://us.posthog.com",
        advanced_disable_feature_flags: true,
        cross_subdomain_cookie: true,
        cookieless_mode: "on_reject",
        session_recording: { maskAllInputs: true }
      });

      return posthog;
    });

    return client;
  };
  const applyConsent = (posthog: PostHog, choice: Consent) => {
    const accepted = choice === "accepted";

    // Each opt-in call sends a `$opt_in` event, so only changes are applied.
    if (accepted && !posthog.has_opted_in_capturing()) posthog.opt_in_capturing();
    if (!accepted && !posthog.has_opted_out_capturing()) posthog.opt_out_capturing();
  };
  const choose = (choice: Consent) => {
    writeConsent(choice, { domain: COOKIE_DOMAIN, secure: SECURE });
    setConsent(choice);
    void loadClient().then((posthog) => applyConsent(posthog, choice));
  };

  onMount(() => {
    if (!ANALYTICS_ENABLED) return;

    const storedConsent = readConsent();

    setConsent(storedConsent);
    void loadClient().then((posthog) => {
      const identified = Boolean(posthog.get_property("$user_id"));

      if (!identified) applyConsent(posthog, storedConsent ?? "declined");

      posthog.capture("$pageview");
    });
  });

  return (
    <Show when={ANALYTICS_ENABLED && consent() === null}>
      <ConsentBanner privacyURL={links.legal.privacy} onChoice={choose} />
    </Show>
  );
};

export { Analytics };
