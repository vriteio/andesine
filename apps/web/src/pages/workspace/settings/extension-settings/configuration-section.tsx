import { type ExtensionConfiguration } from "@andesine/contracts/extensions";
import { type Component, Show } from "solid-js";
import { SettingsSection } from "../settings-section";
import { StaleNotice } from "../webhook/load-notices";
import { ConfigurationFields } from "../extension/configuration-fields";
import { type ConfigurationForm } from "./use-configuration-form";

interface ConfigurationSectionProps {
  schema: ExtensionConfiguration | null;
  form: ConfigurationForm;
}

/** The configuration fields; the page's bottom row saves them. */
const ConfigurationSection: Component<ConfigurationSectionProps> = (props) => (
  <SettingsSection label="Settings">
    <Show when={props.form.stale()}>
      <StaleNotice subject="extension" onReload={props.form.reload} />
    </Show>
    <ConfigurationFields
      schema={props.schema}
      draft={props.form.draft}
      setDraft={props.form.setDraft}
      secrets={props.form.secrets()}
      errors={props.form.errors()}
      disabled={props.form.disabled()}
    />
  </SettingsSection>
);

export { ConfigurationSection };
