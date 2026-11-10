import { type Component, Show, Suspense } from "solid-js";
import { reconcile, type SetStoreFunction } from "solid-js/store";
import { useWorkspace } from "#web/context/workspace";
import type { PublishingChannel } from "#web/lib/data";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { CollectionTreeField } from "./collection-tree-field";
import { getScopeItems, usesChannelFilter, type WebhookDraft } from "./configuration";
import { ScopeField, type ScopeFieldOption } from "./scope-field";
import { SelectableRow } from "./selectable-row";

interface AccessSectionProps {
  channels: PublishingChannel[];
  disabled: boolean;
  draft: WebhookDraft;
  setDraft: SetStoreFunction<WebhookDraft>;
}

const AccessSection: Component<AccessSectionProps> = (props) => {
  const { hasPermission } = useWorkspace();
  const channelOptions = (): ScopeFieldOption[] => {
    return props.channels.map((channel) => ({
      value: channel.code,
      label: channel.name,
      icon: "i-lucide:radio"
    }));
  };
  const showChannelFilter = () => usesChannelFilter(props.draft.eventTypes);
  const canApproveRestricted = () => hasPermission("read:restricted_collections");
  const getChannelLabel = (code: string) => {
    return (
      channelOptions().find((option) => option.value === code)?.label || `Unavailable (${code})`
    );
  };

  return (
    <SettingsSection label="Data access">
      <SelectableRow
        label="Include restricted content"
        description={
          canApproveRestricted() || props.draft.restrictedContent
            ? "Send events for restricted collections, including ones restricted later"
            : "Requires workspace-wide access to restricted collections"
        }
        checked={props.draft.restrictedContent}
        disabled={props.disabled || !canApproveRestricted()}
        setChecked={(checked) => props.setDraft("restrictedContent", checked)}
      />
      <Setting
        label="Collections"
        description="Send events only for checked collections and their subcollections"
        fade={false}
      >
        <CollectionTreeField
          scope={props.draft.collections}
          restrictedContent={props.draft.restrictedContent}
          disabled={props.disabled}
          setScope={(scope) => props.setDraft("collections", reconcile(scope))}
        />
      </Setting>
      <Suspense>
        <Show when={showChannelFilter()}>
          <Setting
            label="Channels"
            description="Send publishing events only for these channels. Leave empty for all channels"
            fade={false}
          >
            <ScopeField
              values={getScopeItems(props.draft.channels)}
              options={channelOptions()}
              placeholder="Search channels"
              emptyLabel="All channels included"
              disabled={props.disabled}
              getLabel={getChannelLabel}
              setValues={(codes) => {
                const scope = codes.length
                  ? { mode: "selected" as const, codes }
                  : { mode: "all" as const };

                props.setDraft("channels", reconcile(scope));
              }}
            />
          </Setting>
        </Show>
      </Suspense>
    </SettingsSection>
  );
};

export { AccessSection };
