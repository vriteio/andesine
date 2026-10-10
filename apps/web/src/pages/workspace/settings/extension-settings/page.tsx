import { Button, Card, IconButton, Tooltip } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { extensionQuery } from "#web/lib/data";
import { getExtensionPath, hasConfiguration } from "../extensions/state";
import { LoadError } from "../webhook/load-notices";
import { ConfigurationSection } from "./configuration-section";
import { useConfigurationForm } from "./use-configuration-form";

interface ExtensionSettingsEditorProps {
  extensionID: string;
  workspaceID: string;
}
interface ExtensionLoadResult {
  error?: true;
  extension: Awaited<ReturnType<typeof extensionQuery>> | null;
}
interface ExtensionSettingsViewProps extends ExtensionSettingsEditorProps {
  extension: NonNullable<ExtensionLoadResult["extension"]>;
}

/** The configuration form, saved from the bottom row. */
const ExtensionSettingsView: Component<ExtensionSettingsViewProps> = (props) => {
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const canManage = () => hasPermission("extensions");
  const form = useConfigurationForm({
    get extensionID() {
      return props.extensionID;
    },
    get workspaceID() {
      return props.workspaceID;
    },
    get schema() {
      return props.extension.details.configuration;
    },
    get canManage() {
      return canManage();
    }
  });

  return (
    <div class="flex min-w-0 flex-col">
      <Show when={hasConfiguration(props.extension)}>
        <ConfigurationSection schema={props.extension.details.configuration} form={form} />
      </Show>
      <Show when={!hasConfiguration(props.extension)}>
        <Card
          class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
          shade
        >
          <div class="i-lucide:settings-2 h-5.5 w-5.5 text-gray-300" />
          No settings
        </Card>
      </Show>
      <div class="flex h-4 w-full items-center justify-center">
        <div class="h-px flex-1 bg-gray-200" />
      </div>
      <div class="flex items-center justify-end gap-2">
        <Tooltip content="Go back">
          <IconButton
            icon="i-lucide:chevron-left"
            disabled={form.saving()}
            onClick={() => navigate(getExtensionPath(props.workspaceID, props.extensionID))}
          />
        </Tooltip>
        <Show when={canManage() && hasConfiguration(props.extension)}>
          <Tooltip
            content={form.fillError()}
            enabled={Boolean(form.fillError())}
            wrapperClass="flex-1"
          >
            <Button
              class="w-full"
              disabled={form.disabled() || Boolean(form.fillError())}
              loading={form.saving()}
              onClick={form.save}
            >
              Save settings
            </Button>
          </Tooltip>
        </Show>
      </div>
    </div>
  );
};
const ExtensionSettingsEditor: Component<ExtensionSettingsEditorProps> = (props) => {
  const navigate = useNavigate();
  const input = () => ({ extensionID: props.extensionID, workspaceID: props.workspaceID });
  const result = createAsync<ExtensionLoadResult>(async () => {
    try {
      return { extension: await extensionQuery(input()) };
    } catch (error) {
      console.error(error);

      return { extension: null, error: true };
    }
  });

  return (
    <Show
      when={!result()?.error}
      fallback={
        <LoadError
          label="This extension could not be loaded"
          onRetry={() => {
            void revalidate(extensionQuery.keyFor(input()));
          }}
          onBack={() => navigate(getExtensionPath(props.workspaceID, props.extensionID))}
        />
      }
    >
      <Show when={result()?.extension}>
        {(extension) => (
          <ExtensionSettingsView
            extensionID={props.extensionID}
            workspaceID={props.workspaceID}
            extension={extension()}
          />
        )}
      </Show>
    </Show>
  );
};
const ExtensionSettingsPage: Component = () => {
  const params = useParams<{ workspaceID?: string; extensionID?: string }>();
  // Keying by route keeps form state separate for each workspace and extension.
  const routeKey = () => `${params.workspaceID || ""}/${params.extensionID || ""}`;

  return (
    <Show when={routeKey()} keyed>
      {(currentKey) => {
        const [workspaceID, extensionID] = currentKey.split("/");

        return <ExtensionSettingsEditor workspaceID={workspaceID} extensionID={extensionID} />;
      }}
    </Show>
  );
};

export default ExtensionSettingsPage;
