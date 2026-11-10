import { type Component } from "solid-js";
import { Button, IconButton } from "../primitives/button";
import { Card } from "../primitives/card";

interface ConsentCookieOptions {
  /** Shared by the landing page and the app when set, e.g. `andesine.app`. */
  domain?: string;
  secure?: boolean;
}
interface ConsentBannerProps {
  privacyURL: string;
  onChoice(consent: Consent): void;
}

type Consent = "accepted" | "declined";

const CONSENT_COOKIE = "andesine-consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

const readConsent = (): Consent | null => {
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);

  return value === "accepted" || value === "declined" ? value : null;
};
const writeConsent = (consent: Consent | null, options: ConsentCookieOptions = {}): void => {
  const attributes = [
    "path=/",
    `max-age=${consent ? CONSENT_MAX_AGE : 0}`,
    "SameSite=Lax",
    ...(options.domain ? [`domain=${options.domain}`] : []),
    ...(options.secure ? ["Secure"] : [])
  ];

  document.cookie = `${CONSENT_COOKIE}=${consent ?? ""}; ${attributes.join("; ")}`;
};
const ConsentBanner: Component<ConsentBannerProps> = (props) => (
  <Card
    class="fixed bottom-3 left-3 right-3 z-80 flex flex-col gap-3 rounded-xl p-3 shadow-lg md:right-auto md:w-72 bg-white"
    role="dialog"
    aria-label="Cookie preferences"
  >
    <p class="m-0 text-sm leading-5 text-gray-500">
      We use cookies to improve Andesine. <br /> Read the{" "}
      <a class="font-medium underline" href={props.privacyURL} target="_blank" rel="noreferrer">
        privacy policy
      </a>
      .
    </p>
    <div class="flex gap-2">
      <IconButton
        variant="secondary"
        class="bg-gray-50"
        onClick={() => props.onChoice("declined")}
        icon="i-lucide:x"
        aria-label="Decline"
      />
      <Button class="flex-1" variant="primary" onClick={() => props.onChoice("accepted")}>
        Accept
      </Button>
    </div>
  </Card>
);

export { ConsentBanner, readConsent, writeConsent };
export type { Consent };
