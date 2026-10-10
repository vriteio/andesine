import clsx from "clsx";
import { A, createAsync, useLocation, useParams } from "@solidjs/router";
import { type Component, createMemo, For, Show } from "solid-js";

import { ExtensionIcon, type ExtensionIconSource } from "#web/components/extensions/extension-icon";
import { useWorkspace } from "#web/context/workspace";
import { config } from "#web/lib/api";
import { extensionsQuery } from "#web/lib/data";
import { useRouteExtension } from "#web/lib/navigation";
import { isSystemDisabled } from "../settings/extensions/state";

interface SettingsMenuItem {
  icon: string;
  /** Replaces `icon` with the extension's own icon. */
  extensionIcon?: ExtensionIconSource | null;
  label: string;
  href: string;
  active?: boolean;
  visible?: boolean;
  /** Marks a setting that needs attention. */
  indicator?: boolean;
  subItems?: SettingsMenuItem[];
}

interface SettingsMenuGroup {
  label?: string;
  items: SettingsMenuItem[];
}

interface SettingsMenuItemRowProps {
  item: SettingsMenuItem;
  nested?: boolean;
  activeBackground?: boolean;
}

const SettingsMenuItemRow: Component<SettingsMenuItemRowProps> = (props) => (
  <A
    href={props.item.href}
    class={clsx(
      ":base: group relative flex min-h-7 w-full flex-1 select-none items-center gap-1 overflow-hidden rounded-r-lg pl-0.5 text-left font-medium focus:outline-none",
      !props.nested && ":base: rounded-l-lg",
      !props.item.active &&
        ":base: @hover:bg-gradient-to-r @hover:from-gray-500/10 @hover:to-transparent"
    )}
  >
    <Show when={props.item.active && (props.activeBackground ?? true)}>
      <div
        class={clsx(
          "pointer-events-none absolute inset-0 rounded-r-lg bg-gradient-to-r from-secondary via-primary to-transparent opacity-10",
          !props.nested && "rounded-l-lg"
        )}
      />
    </Show>
    <div class="relative flex h-6 w-6 items-center justify-center">
      <Show
        when={props.item.extensionIcon}
        fallback={
          <div
            class={clsx(
              "h-5 w-5 text-gray-400",
              props.item.icon,
              props.item.active && "bg-gradient-to-tr"
            )}
          />
        }
      >
        {(source) => (
          <ExtensionIcon
            name={source().name}
            icon={source().icon}
            iconStyles={source().iconStyles}
            class={clsx("h-5 w-5 text-gray-400", props.item.active && "bg-gradient-to-tr")}
          />
        )}
      </Show>
    </div>
    <span class="relative flex-1 line-clamp-1" title={props.item.label}>
      {props.item.label}
    </span>
    <Show when={props.item.indicator}>
      <div class="relative mr-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
    </Show>
  </A>
);

const SettingsMenu: Component = () => {
  const location = useLocation();
  const params = useParams<{
    groupID?: string;
    keyID?: string;
    roleID?: string;
    webhookID?: string;
    workspaceID?: string;
    extensionID?: string;
    scope?: string;
    name?: string;
  }>();
  const { sessions, currentWorkspace, hasPermission } = useWorkspace();
  const routeExtension = useRouteExtension();
  const settingsPath = () => `/${params.workspaceID || ""}/settings`;
  // Managers see when an update or a revocation keeps an extension disabled.
  const extensions = createAsync(async () => {
    const workspaceID = params.workspaceID;

    if (!config.PUBLIC_EXTENSIONS_ENABLED || !workspaceID) return [];

    return extensionsQuery(workspaceID).catch(() => []);
  });
  const isRoute = (route: string) => location.pathname === `${settingsPath()}${route}`;
  const userName = createMemo(() => {
    const user = sessions().find((session) => session.user.id === currentWorkspace()?.userID)?.user;

    return user?.name || user?.email || "Profile";
  });
  const menu = createMemo<SettingsMenuGroup[]>(() => {
    const editingRole = Boolean(params.roleID);
    const editingGroup = Boolean(params.groupID);
    const editingKey = Boolean(params.keyID);
    const roleActive = isRoute("/role") || editingRole;
    const groupActive = isRoute("/group") || editingGroup;
    const keyActive = isRoute("/key") || editingKey;
    const publishableKey = keyActive && location.query.kind === "publishable";
    const editingWebhook = Boolean(params.webhookID) && !params.extensionID;
    const viewingEvents = editingWebhook && location.pathname.endsWith("/events");
    const webhookActive = isRoute("/webhook") || editingWebhook;
    const isPro = currentWorkspace()?.subscriptionPlan === "pro";
    const editingExtension = Boolean(params.extensionID);
    const installingExtension = Boolean(params.scope);
    const viewingExtensionEvents = editingExtension && location.pathname.endsWith("/events");
    const viewingExtensionSettings = editingExtension && location.pathname.endsWith("/settings");
    // The overview and settings pages name the extension; the events page names the webhook.
    const namesExtension = editingExtension && !viewingExtensionEvents;
    const extension = namesExtension ? routeExtension() : null;
    const needsAttention =
      hasPermission("extensions") && (extensions() ?? []).some(isSystemDisabled);

    return [
      {
        label: "Personal",
        items: [
          {
            icon: "i-lucide:circle-user",
            label: userName(),
            href: `${settingsPath()}/personal`,
            active: isRoute("/personal") || location.pathname === settingsPath()
          }
        ]
      },
      ...(currentWorkspace()
        ? [
            {
              label: "Workspace",
              items: [
                {
                  icon: "i-lucide:hexagon",
                  label: "General",
                  href: `${settingsPath()}/workspace`,
                  active: isRoute("/workspace")
                },
                {
                  icon: "i-lucide:users",
                  label: "People",
                  href: `${settingsPath()}/people`,
                  active: isRoute("/people"),
                  visible: true,
                  subItems: [
                    {
                      icon: "i-lucide:user-plus",
                      label: "Invite member",
                      href: `${settingsPath()}/invite`,
                      active: isRoute("/invite"),
                      visible: hasPermission("memberships") && isPro
                    },
                    {
                      icon: editingRole ? "i-lucide:pencil" : "i-lucide:circle-plus",
                      label: editingRole ? "Edit role" : "Create role",
                      href: editingRole
                        ? `${settingsPath()}/role/${encodeURIComponent(params.roleID!)}`
                        : `${settingsPath()}/role`,
                      active: roleActive,
                      visible: hasPermission("roles") && isPro
                    },
                    {
                      icon: editingGroup ? "i-lucide:pencil" : "i-lucide:circle-plus",
                      label: editingGroup ? "Edit group" : "Create group",
                      href: editingGroup
                        ? `${settingsPath()}/group/${encodeURIComponent(params.groupID!)}`
                        : `${settingsPath()}/group`,
                      active: groupActive,
                      visible: hasPermission("memberships") && isPro
                    }
                  ]
                },
                {
                  icon: "i-lucide:radio",
                  label: "Publishing",
                  href: `${settingsPath()}/publishing`,
                  active: isRoute("/publishing"),
                  visible: true
                },
                {
                  icon: "i-lucide:credit-card",
                  label: "Billing",
                  href: `${settingsPath()}/billing`,
                  active: isRoute("/billing"),
                  visible: hasPermission("read:billing") && currentWorkspace()?.billingEnabled
                },
                {
                  icon: "i-tabler:puzzle",
                  label: "Extensions",
                  href: `${settingsPath()}/extensions`,
                  active: isRoute("/extensions"),
                  visible: config.PUBLIC_EXTENSIONS_ENABLED,
                  indicator: needsAttention,
                  subItems: [
                    {
                      icon: installingExtension
                        ? "i-lucide:download"
                        : viewingExtensionEvents
                          ? "i-lucide:send"
                          : viewingExtensionSettings
                            ? "i-lucide:settings-2"
                            : "i-lucide:info",
                      label: installingExtension
                        ? "Install extension"
                        : viewingExtensionEvents
                          ? "Webhook events"
                          : viewingExtensionSettings
                            ? extension
                              ? `${extension.displayName} settings`
                              : "Extension settings"
                            : (extension?.displayName ?? "Extension"),
                      extensionIcon: extension,
                      href: installingExtension
                        ? `${settingsPath()}/extension-install/${params.scope}/${params.name}`
                        : `${settingsPath()}/extension/${encodeURIComponent(params.extensionID || "")}${viewingExtensionSettings ? "/settings" : ""}`,
                      active: editingExtension || installingExtension,
                      visible: editingExtension || installingExtension
                    }
                  ]
                },
                {
                  icon: "i-lucide:code-xml",
                  label: "API",
                  href: `${settingsPath()}/api`,
                  active: isRoute("/api"),
                  visible: hasPermission("read:api_keys") || hasPermission("read:webhooks"),
                  subItems: [
                    {
                      icon: publishableKey ? "i-tabler:circle-key" : "i-lucide:key-round",
                      label: `${editingKey ? "Edit" : "Create"} ${publishableKey ? "publishable" : "secret"} key`,
                      href: `${editingKey ? `${settingsPath()}/key/${encodeURIComponent(params.keyID!)}` : `${settingsPath()}/key`}?kind=${publishableKey ? "publishable" : "secret"}`,
                      active: keyActive,
                      visible: Boolean(params.keyID) || hasPermission("read:api_keys")
                    },
                    {
                      icon: "i-lucide:webhook",
                      label: viewingEvents
                        ? "Webhook events"
                        : editingWebhook
                          ? "Edit webhook"
                          : "Create webhook",
                      href: editingWebhook
                        ? `${settingsPath()}/webhook/${encodeURIComponent(params.webhookID!)}${viewingEvents ? "/events" : ""}`
                        : `${settingsPath()}/webhook`,
                      active: webhookActive,
                      visible: editingWebhook
                        ? hasPermission("read:webhooks")
                        : hasPermission("webhooks")
                    }
                  ]
                }
              ]
            }
          ]
        : [])
    ];
  });

  return (
    <div class="flex min-h-0 flex-col overflow-y-auto px-1 pb-1 scrollbar-sm md:flex-1">
      <h2 class="my-0.5 truncate text-2xl font-semibold">Settings</h2>
      <div class="flex flex-col gap-3">
        <For each={menu()}>
          {(subMenu) => (
            <div class="flex min-w-0 flex-col">
              <Show when={subMenu.label}>
                <span class="ml-1 text-gray-400 text-xs leading-normal">{subMenu.label}</span>
              </Show>
              <div class="flex flex-col gap-0.5">
                <For each={subMenu.items.filter((item) => item.visible ?? true)}>
                  {(item) => {
                    const activeChild = () => {
                      return item.subItems?.find((subItem) => {
                        return (subItem.visible ?? true) && subItem.active;
                      });
                    };

                    return (
                      <>
                        <SettingsMenuItemRow item={item} />
                        <Show when={activeChild()}>
                          {(child) => (
                            <div class="relative flex">
                              <div class="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-r from-secondary via-primary to-transparent opacity-10" />
                              <div class="relative flex min-w-3.5 items-center justify-end pl-0.5">
                                <div class="h-full w-px rounded-full bg-gray-300" />
                              </div>
                              <div class="relative flex flex-1 flex-col">
                                <SettingsMenuItemRow
                                  item={child()}
                                  nested
                                  activeBackground={false}
                                />
                              </div>
                            </div>
                          )}
                        </Show>
                      </>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export { SettingsMenu };
