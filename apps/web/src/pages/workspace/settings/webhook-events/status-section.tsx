import { type Component, Show } from "solid-js";
import type { Webhook } from "#web/lib/data";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { getWebhookHost } from "../webhook/configuration";
import { TimeAgo } from "#web/components/time-ago";

interface StatusSectionProps {
  webhook: Webhook;
}
interface WebhookStatus {
  date?: string | null;
  description: string;
  label: string;
  suffix?: string;
}

// The date renders after the description, followed by the optional suffix.
const getStatus = (webhook: Webhook): WebhookStatus => {
  const { firstFailureAt, lastFailureAt, lastSuccessAt, consecutiveFailures } = webhook.health;
  const failingSince = firstFailureAt || lastFailureAt;

  if (webhook.disabledReason === "failures") {
    return {
      label: "Disabled after repeated failures",
      description: lastFailureAt
        ? "Last failure"
        : "Fix the receiver, then enable the webhook again",
      date: lastFailureAt,
      suffix: lastFailureAt ? ". Fix the receiver, then enable the webhook again" : undefined
    };
  }

  if (!webhook.enabled) {
    return {
      label: "Disabled",
      description: "New events are not recorded for this webhook"
    };
  }

  if (consecutiveFailures > 0 && failingSince) {
    return {
      label: "Failing",
      description: "Events have failed to send since",
      date: failingSince
    };
  }

  return {
    label: "Enabled",
    description: lastSuccessAt ? "Last delivered" : "No events delivered yet",
    date: lastSuccessAt
  };
};
const StatusSection: Component<StatusSectionProps> = (props) => {
  const status = () => getStatus(props.webhook);

  return (
    <SettingsSection label="Status">
      <Setting
        label={status().label}
        description={
          <>
            {status().description}
            <Show when={status().date}>
              {(date) => (
                <>
                  {" "}
                  <TimeAgo date={date()} />
                </>
              )}
            </Show>
            {status().suffix}
          </>
        }
        fade={false}
      >
        <span class="truncate font-mono text-sm text-gray-400" title={props.webhook.url}>
          {getWebhookHost(props.webhook.url)}
        </span>
      </Setting>
    </SettingsSection>
  );
};

export { StatusSection };
