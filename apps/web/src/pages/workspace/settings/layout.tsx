import { Card, ScrollArea, ScrollShadow, Spinner, createRef } from "@andesine/components";
import { Title } from "@solidjs/meta";
import {
  revalidate,
  type RouteSectionProps,
  useLocation,
  useNavigate,
  useParams
} from "@solidjs/router";
import { type Component, createEffect, onCleanup, Show, Suspense } from "solid-js";
import { ExtensionIcon } from "#web/components/extensions/extension-icon";
import { useWorkspace } from "#web/context/workspace";
import { config } from "#web/lib/api";
import { useRouteData } from "#web/lib/navigation";
import { SettingsProvider } from "./settings-context";
import { VerificationDialog } from "./verification-dialog";

const PageSpinner: Component = () => (
  <div class="flex w-full flex-1 items-center justify-center py-16 text-gray-200">
    <Spinner />
  </div>
);
const SettingsLayout: Component<RouteSectionProps> = (props) => {
  const routeData = useRouteData();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string; keyID?: string; webhookID?: string }>();
  const { content, currentWorkspace, hasPermission, subscribeToUpdates } = useWorkspace();
  const [scrollableContainerRef, setScrollableContainerRef] = createRef<HTMLElement | null>(null);
  const title = () => routeData()?.title || "Settings";
  // Only main settings pages (Settings › Page) name the settings area in the document title.
  const documentTitle = () => {
    const mainPage = (routeData()?.breadcrumbs.length ?? 0) <= 2;

    return mainPage ? `${title()} settings | Andesine` : `${title()} | Andesine`;
  };
  const activeRoute = () => {
    return location.pathname
      .slice(`/${params.workspaceID || ""}/settings`.length)
      .split("/")
      .filter(Boolean)[0];
  };
  const canAccessRoute = () => {
    const route = activeRoute();

    if (!route || route === "personal") return true;

    if (!currentWorkspace()) return false;

    if (route === "workspace") return true;

    if (route === "group" || route === "invite" || route === "role") {
      return (
        currentWorkspace()?.subscriptionPlan === "pro" &&
        hasPermission(route === "role" ? "roles" : "memberships")
      );
    }

    if (route === "people") return true;

    if (route === "publishing") return true;

    if (route === "billing") return hasPermission("read:billing");

    if (route === "api") return hasPermission("read:api_keys") || hasPermission("read:webhooks");

    if (route === "key") {
      return params.keyID ? hasPermission("read:api_keys") : hasPermission("api_keys");
    }

    if (route === "webhook") {
      return params.webhookID ? hasPermission("read:webhooks") : hasPermission("webhooks");
    }

    if (route === "extensions" || route === "extension" || route === "extension-install") {
      return config.PUBLIC_EXTENSIONS_ENABLED;
    }

    return false;
  };

  const unsubscribeFromUpdates = subscribeToUpdates((event) => {
    const route = activeRoute();
    const queryKeys = new Set<string>();

    if (route === "workspace" && event.action.startsWith("workspace:")) {
      queryKeys.add("workspaces");
    }

    if (route === "people") {
      if (event.action.startsWith("membership:") || event.action.startsWith("invite:")) {
        queryKeys.add("memberships");
        queryKeys.add("invites");
      }

      if (event.action.startsWith("role:")) {
        queryKeys.add("roles");
        queryKeys.add("memberships");
      }

      if (event.action.startsWith("group:")) {
        queryKeys.add("groups");
      }
    }

    if (route === "invite" && event.action.startsWith("role:")) {
      queryKeys.add("roles");
    }

    if (
      route === "group" &&
      (event.action.startsWith("group:") ||
        event.action.startsWith("invite:") ||
        event.action.startsWith("membership:") ||
        event.action.startsWith("role:"))
    ) {
      queryKeys.add("groups");
      queryKeys.add("invites");
      queryKeys.add("memberships");
      queryKeys.add("roles");
    }

    if (
      route === "role" &&
      (event.action.startsWith("role:") || event.action.startsWith("membership:"))
    ) {
      queryKeys.add("roles");
      queryKeys.add("memberships");
    }

    if (route === "api" && event.action.startsWith("key:")) {
      queryKeys.add("api-keys");
    }

    if (route === "api" && event.action.startsWith("webhook:")) {
      queryKeys.add("webhooks");
    }

    if (route === "webhook" && event.action.startsWith("webhook:")) {
      queryKeys.add("webhooks");
      queryKeys.add("webhook");
      queryKeys.add("webhook-events");
      queryKeys.add("webhook-event");
      queryKeys.add("webhook-event-timeline");
    }

    if (route?.startsWith("extension") && event.action.startsWith("extension:")) {
      queryKeys.add("extensions");
      queryKeys.add("extension");
      queryKeys.add("extension-configuration");
      queryKeys.add("extension-catalog");
      queryKeys.add("extension-catalog-item");
      queryKeys.add("extension-element-views");
      queryKeys.add("extension-webhooks");
      queryKeys.add("webhook-events");
      queryKeys.add("webhook-event");
      queryKeys.add("webhook-event-timeline");
    }

    if (route === "publishing" && event.action.startsWith("publishing:channel-")) {
      queryKeys.add("publishing-channels-with-usage");
    }

    if (route === "publishing" && event.action === "publishing:entries-update") {
      queryKeys.add("publishing-channels-with-usage");
    }

    if (route === "key" && event.action.startsWith("key:")) {
      queryKeys.add("api-keys");
      queryKeys.add("api-key");
    }

    if (route === "billing" && event.action.startsWith("membership:")) {
      queryKeys.add("billing-subscription");
      queryKeys.add("billing-usage");
    }

    if (queryKeys.size > 0) {
      void revalidate([...queryKeys]);
    }
  });

  createEffect(() => {
    if (content.offline()) {
      navigate(`/${params.workspaceID || ""}`, { replace: true });
    }
  });
  createEffect(() => {
    const route = activeRoute();

    if (!currentWorkspace()) return;

    if (
      (route === "group" || route === "invite" || route === "role") &&
      (currentWorkspace()?.subscriptionPlan !== "pro" ||
        !hasPermission(route === "role" ? "roles" : "memberships"))
    ) {
      const fallbackRoute = "people";

      navigate(`/${params.workspaceID || ""}/settings/${fallbackRoute}`, { replace: true });
    }
  });

  onCleanup(unsubscribeFromUpdates);

  return (
    <SettingsProvider>
      <Title>{documentTitle()}</Title>
      <Show when={!content.offline()}>
        <div class="flex w-full flex-1 overflow-hidden px-1">
          <div class="relative flex h-full w-full overflow-hidden">
            <ScrollShadow scrollableContainerRef={scrollableContainerRef} />
            <ScrollArea
              class="z-0 w-full"
              contentClass="flex min-h-full flex-col"
              viewportRef={setScrollableContainerRef}
            >
              <div class="flex w-full flex-1 flex-col items-center px-2.5 pb-5 pt-5 md:px-10 md:pb-10 md:pt-9">
                <div class="relative flex w-full max-w-[44rem] flex-1 flex-col">
                  {/* A new boundary for each page, so navigating shows it at once. The same spinner
                  covers the extension's name loading in the browser and the page's data. */}
                  <Show when={location.pathname} keyed>
                    <Suspense fallback={<PageSpinner />}>
                      <Show when={!routeData()?.loading} fallback={<PageSpinner />}>
                        <div class="mb-3 flex items-start gap-3">
                          <Show when={routeData()?.extensionIcon}>
                            {(source) => (
                              // One line of the title tall, so the icon centers on its first line.
                              <div class="flex h-[1lh] shrink-0 items-center text-4xl md:text-5xl">
                                <ExtensionIcon
                                  name={source().name}
                                  icon={source().icon}
                                  iconStyles={source().iconStyles}
                                  class="h-8 w-8 md:h-10 md:w-10"
                                />
                              </div>
                            )}
                          </Show>
                          <h1 class="min-w-0 text-4xl font-semibold md:text-5xl">{title()}</h1>
                        </div>
                        <Show
                          when={canAccessRoute()}
                          fallback={
                            <Card
                              class="flex h-16 items-center justify-center gap-1 rounded-lg bg-gray-50 px-2 text-sm text-gray-400"
                              shade
                            >
                              <div class="i-lucide:lock h-5.5 w-5.5 text-gray-300" />
                              You don’t have access to this setting.
                            </Card>
                          }
                        >
                          {props.children}
                        </Show>
                      </Show>
                    </Suspense>
                  </Show>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
        <Suspense>
          <VerificationDialog />
        </Suspense>
      </Show>
    </SettingsProvider>
  );
};

export default SettingsLayout;
