import { Input } from "@andesine/components";
import { type Component } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import type { WebhookDraft } from "./configuration";

interface DetailsSectionProps {
  disabled: boolean;
  draft: WebhookDraft;
  setDraft: SetStoreFunction<WebhookDraft>;
}

const DetailsSection: Component<DetailsSectionProps> = (props) => (
  <SettingsSection label="Details">
    <Setting
      label="Name"
      description="A clear label, such as “Production site rebuild”"
      fade={false}
    >
      <Input
        placeholder="My webhook"
        variant="outlined"
        color="contrast"
        size="small"
        value={props.draft.name}
        setValue={(value) => props.setDraft("name", value)}
        disabled={props.disabled}
        maxLength={100}
        class="w-full max-w-md"
      />
    </Setting>
    <Setting
      label="URL"
      description="Andesine sends signed HTTPS POST requests to this address"
      fade={false}
    >
      <Input
        placeholder="https://example.com/webhooks/andesine"
        variant="outlined"
        color="contrast"
        size="small"
        type="url"
        value={props.draft.url}
        setValue={(value) => props.setDraft("url", value)}
        disabled={props.disabled}
        maxLength={2048}
        class="w-full max-w-md"
      />
    </Setting>
  </SettingsSection>
);

export { DetailsSection };
