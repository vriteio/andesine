import { type ExtensionSummary } from "@andesine/contracts/extensions";
import { Button, Card } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createMemo, createSignal, ErrorBoundary, Show, Suspense } from "solid-js";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import { Tree, TREE_ROOT_ID, type TreeMap, TreeSkeleton } from "#web/components/tree";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { extensionsQuery } from "#web/lib/data";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { ExtensionItem } from "./extension-item";
import { formatExtensionCount, getExtensionPath } from "./state";

interface InstalledListProps {
  canManage: boolean;
  workspaceID: string;
  isPending(id: string): boolean;
  onOpen(extension: ExtensionSummary): void;
  onSetEnabled(extensions: ExtensionSummary[], enabled: boolean): void;
  onUninstall(extensions: ExtensionSummary[]): void;
}
interface GroupActionInput {
  action: "enable" | "disable" | "uninstall";
  extensions: ExtensionSummary[];
}
interface LoadErrorProps {
  onRetry(): void;
}

const ACTION_LABELS = { enable: "enabled", disable: "disabled", uninstall: "uninstalled" };

const InstalledList: Component<InstalledListProps> = (props) => {
  // The side menu and notices share this query; deferring keeps its server data from staying pending.
  const extensions = createAsync(() => extensionsQuery(props.workspaceID), {
    initialValue: [],
    deferStream: true
  });
  const getExtensions = (ids: string[]) => {
    return extensions().filter((extension) => ids.includes(extension.id));
  };
  const tree = createMemo<TreeMap>(() => ({
    [TREE_ROOT_ID]: { items: extensions().map((extension) => extension.id), levels: [] }
  }));

  return (
    <Show
      when={extensions().length}
      fallback={
        <Card
          class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
          shade
        >
          <div class="i-tabler:puzzle h-5.5 w-5.5 text-gray-300" />
          No extensions installed
        </Card>
      }
    >
      <Tree
        keyboard
        tree={tree}
        itemHeight="2rem"
        renderItem={(itemID) => {
          const extension = () => extensions().find((current) => current.id === itemID)!;

          return (
            <ExtensionItem
              extension={extension()}
              canManage={props.canManage}
              loading={props.isPending(extension().id)}
              getExtensions={getExtensions}
              onOpen={() => props.onOpen(extension())}
              onSetEnabled={props.onSetEnabled}
              onUninstall={props.onUninstall}
            />
          );
        }}
      />
    </Show>
  );
};
const LoadError: Component<LoadErrorProps> = (props) => (
  <div class="flex h-16 items-center justify-center gap-2 text-sm text-gray-400">
    <div class="i-lucide:circle-alert h-5.5 w-5.5 text-gray-300" />
    Extensions could not be loaded
    <Button variant="secondary" onClick={props.onRetry}>
      Retry
    </Button>
  </div>
);
/** Group actions run the single operation for each extension, with its own revision. */
const InstalledSection: Component = () => {
  const { hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  const notify = useNotify();
  const [uninstallTargets, setUninstallTargets] = createSignal<ExtensionSummary[]>([]);
  const workspaceID = () => params.workspaceID || "";
  const refresh = async (onRefreshed?: () => void) => {
    await revalidate(extensionsQuery.keyFor(workspaceID()));
    onRefreshed?.();
  };
  const groupMutation = createMutation(() => ({
    retry: false,
    mutationFn: (input: GroupActionInput) => {
      return Promise.allSettled(
        input.extensions.map((extension) => {
          const target = { extensionID: extension.id, expectedRevision: extension.revision };

          return input.action === "uninstall"
            ? client.extensions.uninstall(target)
            : client.extensions.setEnabled({ ...target, enabled: input.action === "enable" });
        })
      );
    },
    onSuccess: (results, input) => {
      const failed = results.filter((result) => result.status === "rejected").length;
      const succeeded = results.length - failed;
      const label = ACTION_LABELS[input.action];

      setUninstallTargets([]);

      if (failed) {
        notify({
          type: "error",
          text: succeeded
            ? `${formatExtensionCount(succeeded)} ${label}; ${failed} failed. Check the list before trying again`
            : `Failed to update ${formatExtensionCount(failed)}. Check the list before trying again`
        });
      } else {
        const subject = succeeded === 1 ? "Extension" : formatExtensionCount(succeeded);

        notify({ type: "success", text: `${subject} ${label}` });
      }

      void refresh();
    }
  }));
  // Spinners belong only to extensions with an action in progress.
  const isPending = (id: string) => {
    return (
      groupMutation.isPending &&
      Boolean(groupMutation.variables?.extensions.some((extension) => extension.id === id))
    );
  };

  return (
    <SettingsSection label="Installed">
      <ActionConfirmationDialog
        opened={uninstallTargets().length > 0}
        title={`Uninstall ${formatExtensionCount(uninstallTargets().length)}?`}
        description="Uninstalling deletes their configuration, secret fields, and stored data. Their backends receive a final event."
        affected={uninstallTargets().map((extension) => ({
          id: extension.id,
          icon: "i-tabler:puzzle",
          label: extension.displayName,
          detail: extension.name
        }))}
        action={{
          color: "danger",
          label: "Uninstall",
          loading: groupMutation.isPending,
          onClick: () => {
            groupMutation.mutate({ action: "uninstall", extensions: uninstallTargets() });
          }
        }}
        onClose={() => {
          if (!groupMutation.isPending) setUninstallTargets([]);
        }}
      />
      <div class="flex flex-col">
        <Setting
          label="Extensions"
          description="Extensions add views, actions, and panels, and can run their own backends"
        />
        <div class="relative flex w-full flex-col">
          <ErrorBoundary fallback={(_, reset) => <LoadError onRetry={() => refresh(reset)} />}>
            <Suspense
              fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={2} size="medium" />}
            >
              <InstalledList
                workspaceID={workspaceID()}
                canManage={hasPermission("extensions")}
                isPending={isPending}
                onOpen={(extension) => navigate(getExtensionPath(workspaceID(), extension.id))}
                onSetEnabled={(extensions, enabled) => {
                  groupMutation.mutate({ action: enabled ? "enable" : "disable", extensions });
                }}
                onUninstall={setUninstallTargets}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </SettingsSection>
  );
};

export { InstalledSection };
