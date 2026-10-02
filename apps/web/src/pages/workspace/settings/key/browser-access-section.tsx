import { TagInput, ToggleGroup } from "@andesine/components";
import { type Component } from "solid-js";
import { useDelegationPermissions } from "#web/lib/policy/delegation";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import type { Webhook } from "#web/lib/data";
import { CollectionTreeField } from "../webhook/collection-tree-field";

interface BrowserAccessSectionProps {
  disabled: boolean;
  collections: Webhook["collections"];
  allowedOrigins: string[];
  answers: boolean;
  setCollections(collections: Webhook["collections"]): void;
  setAllowedOrigins(allowedOrigins: string[]): void;
  setAnswers(answers: boolean): void;
}

const originPattern = /^https?:\/\/[a-z\d.-]+(?::\d{1,5})?$/i;

/** The scope of a publishable key: the published collections, browser origins, and AI answers. */
const BrowserAccessSection: Component<BrowserAccessSectionProps> = (props) => {
  const { canGrantKeyPermission } = useDelegationPermissions();

  return (
    <SettingsSection label="Browser access">
      <Setting
        label="Collections"
        description="Publishing-enabled collections that the key can read, with their subcollections"
        fade={false}
      >
        <CollectionTreeField
          disabled={props.disabled}
          restrictedContent
          publishingOnly
          scope={props.collections}
          setScope={props.setCollections}
        />
      </Setting>
      <Setting
        label="Allowed origins"
        description="Sites that can use the key. Localhost is always allowed"
        fade={false}
      >
        <TagInput
          inputClass="bg-white"
          tagListClass="justify-end"
          values={props.allowedOrigins}
          setValues={(origins) => {
            props.setAllowedOrigins(origins.map((origin) => origin.trim().toLowerCase()));
          }}
          disabled={props.disabled}
          disableAutoFocus
          maxValues={20}
          placeholder="https://docs.example.com"
          validate={(origins) => {
            return origins.every((origin) => originPattern.test(origin))
              ? undefined
              : "Use origins without a path, e.g. https://docs.example.com";
          }}
        />
      </Setting>
      <Setting label="AI answers" description="Answer questions about the content" fade={false}>
        <ToggleGroup
          disabled={props.disabled}
          value={props.answers ? "on" : "off"}
          setValue={(value) => props.setAnswers(value === "on")}
          options={[
            { value: "off", label: "None" },
            ...(canGrantKeyPermission("ai-answers") ? [{ value: "on", label: "Allow" }] : [])
          ]}
        />
      </Setting>
    </SettingsSection>
  );
};

export { BrowserAccessSection, originPattern };
