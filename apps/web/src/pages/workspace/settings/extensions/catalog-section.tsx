import { type ExtensionCatalogItem } from "@andesine/contracts/extensions";
import { Button, Card } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { type Component, createMemo, ErrorBoundary, Show, Suspense } from "solid-js";
import { ExtensionIcon } from "#web/components/extensions/extension-icon";
import { Tree, TREE_ROOT_ID, TreeItem, type TreeMap, TreeSkeleton } from "#web/components/tree";
import { extensionCatalogQuery } from "#web/lib/data";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { getInstallPath } from "./state";

interface CatalogListProps {
  workspaceID: string;
  onOpen(item: ExtensionCatalogItem): void;
}
interface LoadErrorProps {
  onRetry(): void;
}

const CatalogList: Component<CatalogListProps> = (props) => {
  const catalog = createAsync(() => extensionCatalogQuery(props.workspaceID), {
    initialValue: []
  });
  // Installed extensions are in the installed list instead.
  const items = createMemo(() => catalog().filter((item) => !item.installed));
  const tree = createMemo<TreeMap>(() => ({
    [TREE_ROOT_ID]: { items: items().map((item) => item.name), levels: [] }
  }));

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
      <Tree
        keyboard
        tree={tree}
        itemHeight="2rem"
        renderItem={(itemID) => {
          const item = () => items().find((current) => current.name === itemID)!;

          return (
            <TreeItem
              id={item().name}
              label={item().displayName}
              topLevel
              class="px-1 py-0.5"
              icon={
                <ExtensionIcon
                  name={item().name}
                  icon={item().icon}
                  iconStyles={item().iconStyles}
                  class="h-5 w-5"
                />
              }
              onClick={() => props.onOpen(item())}
              renderLabel={(label) => (
                <div class="flex min-w-0 flex-1 items-center gap-1.5" title={item().description}>
                  <div class="shrink-0">{label}</div>
                  <span class="hidden min-w-0 truncate text-xs text-gray-400 sm:inline">
                    {item().description}
                  </span>
                  <div class="flex-1" />
                  <span class="shrink-0 text-xs text-gray-400">{item().version}</span>
                </div>
              )}
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
          description="Reviewed extensions from the registry; they update automatically"
        />
        <div class="relative flex w-full flex-col">
          <ErrorBoundary fallback={(_, reset) => <LoadError onRetry={() => refresh(reset)} />}>
            <Suspense
              fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={3} size="medium" />}
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
