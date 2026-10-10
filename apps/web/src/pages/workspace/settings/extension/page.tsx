import { Button, IconButton, Tooltip } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createSignal, Show } from "solid-js";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { extensionQuery, extensionsQuery, getWebhookErrorCode } from "#web/lib/data";
import { getExtensionSettingsPath } from "../extensions/state";
import { SettingsSection } from "../settings-section";
import { LoadError, StaleNotice } from "../webhook/load-notices";
import { OverviewSection } from "./overview-section";
import { ServiceNotice } from "./service-notice";
import { ViewsSection } from "./views-section";
import { WebhooksSection } from "./webhooks-section";

interface ExtensionEditorProps {
  extensionID: string;
  workspaceID: string;
}
interface ExtensionLoadResult {
  error?: true;
  extension: Awaited<ReturnType<typeof extensionQuery>> | null;
}

// Content views, and for development extensions their webhooks, as the manifest declares them.
const hasResources = (extension: NonNullable<ExtensionLoadResult["extension"]>): boolean => {
  const { elementViews, webhooks } = extension.details;

  return elementViews.length > 0 || (extension.development && webhooks.length > 0);
};
const ExtensionEditor: Component<ExtensionEditorProps> = (props) => {
  const notify = useNotify();
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const [stale, setStale] = createSignal(false);
  const [uninstalling, setUninstalling] = createSignal(false);
  const [switching, setSwitching] = createSignal(false);
  const input = () => ({ extensionID: props.extensionID, workspaceID: props.workspaceID });
  const result = createAsync<ExtensionLoadResult>(async () => {
    try {
      return { extension: await extensionQuery(input()) };
    } catch (error) {
      console.error(error);

      return { extension: null, error: true };
    }
  });
  const canManage = () => hasPermission("extensions");
  // The manager's choice; an update or a revocation can still keep it from running.
  const enabled = () => result()?.extension?.disabledReason !== "manual";
  const extensionsPath = () => `/${props.workspaceID}/settings/extensions`;
  const settingsPath = () => getExtensionSettingsPath(props.workspaceID, props.extensionID);
  const refresh = () => {
    setStale(false);
    void revalidate([extensionQuery.keyFor(input()), extensionsQuery.keyFor(props.workspaceID)]);
  };
  const handleError = (error: unknown, fallback: string) => {
    const code = getWebhookErrorCode(error);

    console.error(error);

    if (code === "CONFLICT" || code === "NOT_FOUND") {
      setStale(true);
      notify({ type: "error", text: "Extension changed. Reload it to continue" });
    } else if (code === "FORBIDDEN" && error instanceof Error) {
      notify({ type: "error", text: error.message });
    } else {
      notify({ type: "error", text: fallback });
    }
  };
  const stateMutation = createMutation(() => ({
    retry: false,
    mutationFn: (enabled: boolean) => {
      const extension = result()!.extension!;

      return client.extensions.setEnabled({
        extensionID: extension.id,
        enabled,
        expectedRevision: extension.revision
      });
    },
    onSuccess: (state) => {
      notify({
        type: "success",
        text: state.disabledReason ? "Extension disabled" : "Extension enabled"
      });
      setSwitching(false);
      refresh();
    },
    onError: (error) => {
      setSwitching(false);
      handleError(error, "Failed to change the extension state");
    }
  }));
  const approveMutation = createMutation(() => ({
    retry: false,
    mutationFn: () => {
      const extension = result()!.extension!;

      return client.extensions.approve({
        extensionID: extension.id,
        expectedRevision: extension.revision
      });
    },
    onSuccess: (state) => {
      notify({
        type: "success",
        text:
          state.state === "active"
            ? "Update approved"
            : "Update approved; it still needs configuration"
      });
      refresh();
    },
    onError: (error) => handleError(error, "Failed to approve the update")
  }));
  const uninstallMutation = createMutation(() => ({
    retry: false,
    mutationFn: () => {
      const extension = result()!.extension!;

      return client.extensions.uninstall({
        extensionID: extension.id,
        expectedRevision: extension.revision
      });
    },
    onSuccess: () => {
      notify({ type: "success", text: "Extension uninstalled" });
      void revalidate(extensionsQuery.keyFor(props.workspaceID));
      navigate(extensionsPath(), { replace: true });
    },
    onError: (error) => {
      setUninstalling(false);
      handleError(error, "Failed to uninstall the extension");
    }
  }));
  const busy = () => {
    return stateMutation.isPending || approveMutation.isPending || uninstallMutation.isPending;
  };

  return (
    <Show
      when={!result()?.error}
      fallback={
        <LoadError
          label="This extension could not be loaded"
          onRetry={refresh}
          onBack={() => navigate(extensionsPath())}
        />
      }
    >
      <Show when={result()?.extension}>
        {(extension) => (
          <div class="flex min-w-0 flex-col">
            <ActionConfirmationDialog
              opened={uninstalling()}
              title={`Uninstall ${extension().displayName}?`}
              description="Uninstalling deletes its configuration, secret fields, and stored data. Its backend receives a final event."
              affected={[]}
              action={{
                color: "danger",
                label: "Uninstall",
                loading: uninstallMutation.isPending,
                onClick: () => uninstallMutation.mutate()
              }}
              onClose={() => {
                if (!uninstallMutation.isPending) setUninstalling(false);
              }}
            />
            <ActionConfirmationDialog
              opened={switching()}
              title={`${enabled() ? "Disable" : "Enable"} ${extension().displayName}?`}
              description={
                enabled()
                  ? "Its panels, views, and actions stop working for everyone in the workspace, and its external service stops receiving events."
                  : "Its panels, views, and actions become available to everyone in the workspace."
              }
              affected={[]}
              action={{
                color: enabled() ? "danger" : "primary",
                label: enabled() ? "Disable" : "Enable",
                loading: stateMutation.isPending,
                onClick: () => stateMutation.mutate(!enabled())
              }}
              onClose={() => {
                if (!stateMutation.isPending) setSwitching(false);
              }}
            />
            <Show when={stale()}>
              <StaleNotice subject="extension" onReload={refresh} />
            </Show>
            <OverviewSection
              extension={extension()}
              canManage={canManage() && !stale()}
              busy={busy() || stale()}
              approving={approveMutation.isPending}
              onSwitch={() => setSwitching(true)}
              onApprove={() => approveMutation.mutate()}
              onOpenSettings={() => navigate(settingsPath())}
            />
            <ServiceNotice
              target={input()}
              revision={extension().revision}
              canManage={canManage() && !stale()}
              onConflict={() => setStale(true)}
            />
            <Show when={hasResources(extension())}>
              <SettingsSection label="Extension resources">
                <ViewsSection
                  target={input()}
                  revision={extension().revision}
                  canManage={canManage() && !stale()}
                  elementViews={extension().details.elementViews}
                  onConflict={() => setStale(true)}
                />
                {/* Webhook delivery details are for developers. */}
                <Show when={extension().development}>
                  <WebhooksSection
                    target={input()}
                    revision={extension().revision}
                    canManage={canManage() && !stale()}
                    onConflict={() => setStale(true)}
                  />
                </Show>
              </SettingsSection>
            </Show>
            <div class="flex h-4 w-full items-center justify-center">
              <div class="h-px flex-1 bg-gray-200" />
            </div>
            <div class="flex items-center justify-end gap-2">
              <Tooltip content="Go back">
                <IconButton
                  icon="i-lucide:chevron-left"
                  disabled={busy()}
                  onClick={() => navigate(extensionsPath())}
                />
              </Tooltip>
              <Show when={canManage()}>
                <Button
                  variant="danger"
                  class="flex-1"
                  disabled={busy() || stale()}
                  onClick={() => setUninstalling(true)}
                >
                  Uninstall
                </Button>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </Show>
  );
};
const ExtensionPage: Component = () => {
  const params = useParams<{ workspaceID?: string; extensionID?: string }>();
  // Keying by route keeps editor state separate for each workspace and extension.
  const routeKey = () => `${params.workspaceID || ""}/${params.extensionID || ""}`;

  return (
    <Show when={routeKey()} keyed>
      {(currentKey) => {
        const [workspaceID, extensionID] = currentKey.split("/");

        return <ExtensionEditor workspaceID={workspaceID} extensionID={extensionID} />;
      }}
    </Show>
  );
};

export default ExtensionPage;
