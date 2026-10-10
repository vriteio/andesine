import { type ExtensionDetails } from "@andesine/contracts/extensions";
import { Button, IconButton, Tooltip } from "@andesine/components";
import { type Component, Show } from "solid-js";
import { getGrantChanges } from "#web/lib/extensions";
import { useDelegationPermissions } from "#web/lib/policy/delegation";
import { hasConfiguration } from "../extensions/state";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { AccessSummary } from "./access-summary";
import { Notice } from "./notice";
import { canGrantExtensionPermission } from "./permissions";

interface OverviewSectionProps {
  extension: ExtensionDetails;
  canManage: boolean;
  busy: boolean;
  approving: boolean;
  onSwitch(): void;
  onApprove(): void;
  onOpenSettings(): void;
}
/**
 * The extension's description, what it can do, its on/off button, and a notice when it needs a
 * manager: an update to approve, configuration to fill in, or a revoked version.
 */
const OverviewSection: Component<OverviewSectionProps> = (props) => {
  const canGrant = canGrantExtensionPermission(useDelegationPermissions());
  // The manager's choice; an update or a revocation can still keep it from running.
  const enabled = () => props.extension.disabledReason !== "manual";
  const pending = () => props.extension.pendingGrant;
  const blocked = () => pending()?.permissions.some((permission) => !canGrant(permission));

  return (
    <SettingsSection label="Extension">
      <div class="flex flex-col gap-3">
        <div class="flex flex-col">
          <Setting
            label={
              <span class="flex items-center gap-2">
                Overview
                <Show when={props.extension.development}>
                  <span class="text-xs font-normal text-gray-400">Development</span>
                </Show>
              </span>
            }
            description={props.extension.description}
            fade={false}
          >
            <div class="flex items-center gap-1">
              <Show when={hasConfiguration(props.extension)}>
                <Tooltip content="Open settings">
                  <IconButton icon="i-lucide:settings-2" onClick={props.onOpenSettings} />
                </Tooltip>
              </Show>
              <Show when={props.canManage}>
                <IconButton
                  label={() => <span class="px-1">{enabled() ? "Disable" : "Enable"}</span>}
                  class="flex-row-reverse pr-1"
                  iconProps={{ class: "h-4 w-4" }}
                  icon={enabled() ? "i-lucide:pause" : "i-lucide:play"}
                  disabled={props.busy}
                  onClick={props.onSwitch}
                />
              </Show>
            </div>
          </Setting>
          <AccessSummary grant={props.extension.grant} />
        </div>
        <Show when={pending()}>
          {(grant) => (
            <Notice
              icon="i-lucide:circle-alert text-red-500"
              actions={
                <Show when={props.canManage}>
                  <Tooltip
                    content="You can't give every permission it asks for"
                    enabled={Boolean(blocked())}
                  >
                    <Button
                      disabled={Boolean(blocked()) || props.busy}
                      loading={props.approving}
                      onClick={props.onApprove}
                    >
                      Allow and enable
                    </Button>
                  </Tooltip>
                </Show>
              }
            >
              <p class="font-medium">An update needs your approval</p>
              <AccessSummary
                grant={grant()}
                changes={getGrantChanges(props.extension.grant, grant())}
                canGrant={canGrant}
              />
            </Notice>
          )}
        </Show>
        <Show when={props.extension.disabledReason === "configuration_required"}>
          <Notice
            icon="i-lucide:circle-alert text-red-500"
            actions={<Button onClick={props.onOpenSettings}>Open settings</Button>}
          >
            Fill in the required settings to enable it.
          </Notice>
        </Show>
        <Show when={props.extension.disabledReason === "revoked"}>
          <Notice icon="i-lucide:shield-x text-red-500">
            Disabled by its developer. It's enabled again when they publish a fix.
          </Notice>
        </Show>
      </div>
    </SettingsSection>
  );
};

export { OverviewSection };
