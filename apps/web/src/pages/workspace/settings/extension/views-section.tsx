import {
  type ExtensionDetails,
  type ExtensionElementViewSetting
} from "@andesine/contracts/extensions";
import { Card, Input } from "@andesine/components";
import { createAsync, revalidate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import { useNotify } from "#web/context/notifications";
import { client } from "#web/lib/api";
import { createOptimisticOverrides } from "#web/lib/primitives";
import {
  extensionActiveViewsQuery,
  extensionElementViewsQuery,
  extensionQuery,
  type ExtensionQueryInput,
  getWebhookErrorCode
} from "#web/lib/data";
import { Setting } from "../setting";
import { SelectableRow } from "../webhook/selectable-row";

interface ViewsSectionProps {
  target: ExtensionQueryInput;
  revision: number;
  canManage: boolean;
  /** The manifest's views, which list their descendant elements. */
  elementViews: ExtensionDetails["details"]["elementViews"];
  onConflict(): void;
}
interface ViewChange {
  view: ExtensionElementViewSetting;
  enabled: boolean;
}

/** Each element has one view per workspace; enabling another extension's view replaces it. */
const ViewsSection: Component<ViewsSectionProps> = (props) => {
  const notify = useNotify();
  const [pendingChange, setPendingChange] = createSignal<ViewChange | null>(null);
  const [search, setSearch] = createSignal("");
  const views = createAsync(() => extensionElementViewsQuery(props.target), { initialValue: [] });
  // Filters locally by element or view name.
  const filteredViews = createMemo(() => {
    const query = search().trim().toLowerCase();

    return views().filter(({ element, name }) => {
      const matches = [element, name].some((text) => text.toLowerCase().includes(query));

      return !query || matches;
    });
  });
  // The new state shows until the refetched views take over.
  const optimistic = createOptimisticOverrides<boolean>((viewID): boolean => {
    return viewMutation.isPending && viewMutation.variables?.view.viewID === viewID;
  });
  const viewMutation = createMutation(() => ({
    retry: false,
    onMutate: (change: ViewChange): void => optimistic.set(change.view.viewID, change.enabled),
    mutationFn: (change: ViewChange) => {
      return client.extensions.setElementViewEnabled({
        extensionID: props.target.extensionID,
        viewID: change.view.viewID,
        enabled: change.enabled,
        expectedRevision: props.revision
      });
    },
    onSuccess: (_, change) => {
      setPendingChange(null);
      notify({
        type: "success",
        text: `${change.view.name} ${change.enabled ? "enabled" : "disabled"}`
      });
      void revalidate([
        extensionElementViewsQuery.keyFor(props.target),
        extensionQuery.keyFor(props.target),
        extensionActiveViewsQuery.keyFor(props.target.workspaceID)
      ]);
    },
    onError: (error, change) => {
      const code = getWebhookErrorCode(error);

      console.error(error);
      setPendingChange(null);
      optimistic.clear(change.view.viewID);

      if (code === "CONFLICT" || code === "NOT_FOUND") {
        props.onConflict();
      } else {
        notify({ type: "error", text: "Failed to change the view" });
      }
    }
  }));
  const isEnabled = (view: ExtensionElementViewSetting) => {
    return optimistic.get(view.viewID) ?? view.enabled;
  };
  const getManifestView = (view: ExtensionElementViewSetting) => {
    return props.elementViews.find(({ id }) => id === view.viewID);
  };
  // Views with descendant elements render content, so their tag isn't self-closing.
  const getTag = (view: ExtensionElementViewSetting) => {
    return getManifestView(view)?.descendants.length ? `<${view.element}>` : `<${view.element}/>`;
  };
  const change = (view: ExtensionElementViewSetting, enabled: boolean) => {
    if (enabled && view.provider) {
      setPendingChange({ view, enabled });
    } else {
      viewMutation.mutate({ view, enabled });
    }
  };

  optimistic.sync(views);

  return (
    <Show when={views().length}>
      <div class="flex flex-col">
        <ActionConfirmationDialog
          opened={Boolean(pendingChange())}
          title={`Use ${pendingChange()?.view.name ?? ""}?`}
          description={`${pendingChange()?.view.provider?.name ?? ""} shows ${pendingChange()?.view.element ?? ""} now. This replaces it for everyone in the workspace.`}
          affected={[]}
          action={{
            color: "primary",
            label: "Replace view",
            loading: viewMutation.isPending,
            onClick: () => {
              const pending = pendingChange();

              if (pending) viewMutation.mutate(pending);
            }
          }}
          onClose={() => {
            if (!viewMutation.isPending) setPendingChange(null);
          }}
        />
        <Setting
          label="Content views"
          description="Show elements of your content with the extension's own views in the editor"
          fade={false}
        >
          <Input
            placeholder="Search views"
            value={search()}
            setValue={setSearch}
            class="w-full max-w-md"
          />
        </Setting>
        <For
          each={filteredViews()}
          fallback={
            <Card
              class="my-1 flex h-10 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
              shade
            >
              <div class="i-lucide:search-x h-4.5 w-4.5 text-gray-300" />
              No matching views
            </Card>
          }
        >
          {(view) => (
            <SelectableRow
              label={<span class="break-all font-mono text-sm">{getTag(view)}</span>}
              description={getManifestView(view)?.description}
              checked={isEnabled(view)}
              disabled={!props.canManage || viewMutation.isPending}
              setChecked={(checked) => change(view, checked)}
              loading={
                viewMutation.isPending && viewMutation.variables?.view.viewID === view.viewID
              }
            />
          )}
        </For>
      </div>
    </Show>
  );
};

export { ViewsSection };
