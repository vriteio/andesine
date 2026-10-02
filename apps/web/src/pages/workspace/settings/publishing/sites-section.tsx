import { IconButton } from "@andesine/components";
import { useNavigate, useParams } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";

/** Points to publishable keys, which let sites read published content from browsers. */
const SitesSection: Component = () => {
  const { hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();

  return (
    <Show when={hasPermission("api_keys")}>
      <SettingsSection label="Sites">
        <Setting
          label="Publishable keys"
          description="Read and search published content from a site's browser code, e.g. a docs site"
          fade={false}
        >
          <IconButton
            label={() => <span class="px-1">Create publishable key</span>}
            class="flex-row-reverse pr-1"
            onClick={() => {
              navigate(`/${params.workspaceID || ""}/settings/key?kind=publishable`);
            }}
            iconProps={{ class: "h-4 w-4" }}
            icon="i-lucide:plus"
            size="small"
            color="contrast"
            variant="outlined"
            text="soft"
          />
        </Setting>
      </SettingsSection>
    </Show>
  );
};

export { SitesSection };
