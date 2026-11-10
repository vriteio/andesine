import { Tree, TREE_ROOT_ID, TreeSkeleton } from "#web/components/tree";
import { Card } from "@andesine/components";
import { type Component, createMemo, Show, Suspense, useTransition } from "solid-js";
import { createAsync, revalidate } from "@solidjs/router";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { ConnectedAppItem } from "./connected-app-item";
import { connectedAppsQuery, useRevokeConnectedAppsMutation } from "#web/lib/data";

type ConnectedApp = Awaited<ReturnType<typeof connectedAppsQuery>>[number];

interface ConnectedAppListProps {
  apps: ConnectedApp[];
  appsRefreshing?: boolean;
  refreshApps(onRevalidate?: () => void): void;
}

const ConnectedAppList: Component<ConnectedAppListProps> = (props) => {
  const revokeMutation = useRevokeConnectedAppsMutation({ refresh: props.refreshApps });
  const visibleApps = createMemo(() => {
    const revokedIDs = revokeMutation.variables?.clientIDs ?? [];
    const revoking = revokeMutation.isPending || props.appsRefreshing;

    if (!revoking) return props.apps;

    return props.apps.filter(({ clientID }) => !revokedIDs.includes(clientID));
  });
  const appsTree = () => ({
    [TREE_ROOT_ID]: {
      items: visibleApps().map(({ clientID }) => clientID),
      levels: []
    }
  });

  return (
    <Show
      when={visibleApps().length}
      fallback={
        <Card
          class="rounded-lg text-gray-400 bg-white text-sm px-2 h-16 flex items-center justify-center gap-1"
          shade
        >
          <div class="i-lucide:plug h-5 w-5 text-gray-300" /> No connected apps
        </Card>
      }
    >
      <Tree
        keyboard
        tree={appsTree}
        itemHeight="2rem"
        renderItem={(itemID) => {
          const app = () => visibleApps().find(({ clientID }) => clientID === itemID)!;

          return (
            <ConnectedAppItem
              {...app()}
              onRevoke={(clientIDs) => revokeMutation.mutate({ clientIDs })}
            />
          );
        }}
      />
    </Show>
  );
};
const ConnectedAppsSection: Component = () => {
  const apps = createAsync(() => connectedAppsQuery());
  const [appsRefreshing, startAppsRefresh] = useTransition();
  const refreshApps = (onRevalidate?: () => void) => {
    void startAppsRefresh(() => {
      void (async () => {
        await revalidate(connectedAppsQuery.key);
        onRevalidate?.();
      })();
    });
  };

  return (
    <SettingsSection label="Connected apps">
      <div class="flex flex-col">
        <Setting
          label="Apps with access"
          description="The CLI, MCP clients and other apps that you connected to your account"
          fade={false}
        />
        <div class="w-full flex flex-col relative">
          <Suspense
            fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={2} size="medium" />}
          >
            <ConnectedAppList
              apps={apps() || []}
              appsRefreshing={appsRefreshing()}
              refreshApps={refreshApps}
            />
          </Suspense>
        </div>
      </div>
    </SettingsSection>
  );
};

export { ConnectedAppsSection };
