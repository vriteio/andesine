import { type ExtensionCatalogItem } from "@andesine/contracts/extensions";
import { Button, Card, Skeleton } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { type Component, createMemo, ErrorBoundary, For, Show, Suspense } from "solid-js";
import { ExtensionIcon } from "#web/components/extensions/extension-icon";
import { extensionCatalogQuery } from "#web/lib/data";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { getInstallPath } from "./state";

interface CatalogListProps {
  workspaceID: string;
  onOpen(item: ExtensionCatalogItem): void;
}
interface CatalogCardProps {
  item: ExtensionCatalogItem;
  onOpen(): void;
}
interface LoadErrorProps {
  onRetry(): void;
}

const CatalogCard: Component<CatalogCardProps> = (props) => (
  <button
    type="button"
    class="flex min-w-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-[0_0_12px_0px] shadow-gray-900/8 outline-none @hover:bg-gray-50 focus-visible:bg-gray-50"
    onClick={props.onOpen}
  >
    <div class="flex w-full items-center gap-2">
      <ExtensionIcon
        name={props.item.name}
        icon={props.item.icon}
        iconStyles={props.item.iconStyles}
        class="h-10 w-10 shrink-0"
      />
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex items-center gap-2">
          <span class="flex-1 truncate font-medium text-gray-900">{props.item.displayName}</span>
          <div class="i-lucide:arrow-right h-4 w-4 shrink-0 text-gray-300" />
        </div>
        <span class="truncate font-mono text-xs text-gray-400">{props.item.version}</span>
      </div>
    </div>
    <p class="line-clamp-3 px-1 text-sm text-gray-500">{props.item.description}</p>
  </button>
);
const CatalogList: Component<CatalogListProps> = (props) => {
  const catalog = createAsync(() => extensionCatalogQuery(props.workspaceID), {
    initialValue: []
  });
  // Installed extensions are in the installed list instead.
  const items = createMemo(() => catalog().filter((item) => !item.installed));

  return (
    <Show
      when={items().length}
      fallback={
        <Card
          class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
          shade
        >
          <div class="i-tabler:puzzle h-5.5 w-5.5 text-gray-300" />
          No extensions available
        </Card>
      }
    >
      <div class="grid grid-cols-1 gap-2 @lg/catalog:grid-cols-2">
        <For each={items()}>
          {(item) => <CatalogCard item={item} onOpen={() => props.onOpen(item)} />}
        </For>
      </div>
    </Show>
  );
};
const LoadError: Component<LoadErrorProps> = (props) => (
  <div class="flex h-16 items-center justify-center gap-2 text-sm text-gray-400">
    <div class="i-lucide:circle-alert h-5.5 w-5.5 text-gray-300" />
    The catalog could not be loaded
    <Button variant="secondary" onClick={props.onRetry}>
      Retry
    </Button>
  </div>
);
/** Registry extensions that aren't installed; each opens its install review. */
const CatalogSection: Component = () => {
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  const workspaceID = () => params.workspaceID || "";
  const refresh = async (onRefreshed: () => void) => {
    await revalidate(extensionCatalogQuery.keyFor(workspaceID()));
    onRefreshed();
  };

  return (
    <SettingsSection label="Catalog">
      <div class="flex flex-col">
        <Setting
          label="Available extensions"
          description="Extend your workspace with more features and integrations"
        />
        <div class="@container/catalog relative flex w-full flex-col">
          <ErrorBoundary fallback={(_, reset) => <LoadError onRetry={() => refresh(reset)} />}>
            <Suspense
              fallback={
                <div class="grid grid-cols-1 gap-2 @lg/catalog:grid-cols-2">
                  <Skeleton class={["h-30 rounded-2xl", "h-30 rounded-2xl", "h-30 rounded-2xl"]} />
                </div>
              }
            >
              <CatalogList
                workspaceID={workspaceID()}
                onOpen={(item) => navigate(getInstallPath(workspaceID(), item.name))}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </SettingsSection>
  );
};

export { CatalogSection };
