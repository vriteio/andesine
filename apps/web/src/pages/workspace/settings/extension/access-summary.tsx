import { type ExtensionGrant, type ExtensionPermission } from "@andesine/contracts/extensions";
import clsx from "clsx";
import { type Component, For, type JSX, Show } from "solid-js";
import { describeExtensionPermission, getURLHost, type GrantChanges } from "#web/lib/extensions";

interface AccessSummaryProps {
  grant: ExtensionGrant;
  /** Shows only what an update adds to the approved access. */
  changes?: GrantChanges;
  /** Whether the current member can give a permission; others are marked. */
  canGrant?(permission: ExtensionPermission): boolean;
}
interface AccessLineProps {
  icon: string;
  label: string;
  children: JSX.Element;
}
interface PermissionListProps {
  permissions: ExtensionPermission[];
  canGrant?(permission: ExtensionPermission): boolean;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const formatHosts = (urls: string[]) => [...new Set(urls.map(getURLHost))].join(", ");

// A row like the settings tree lists: icon, a light label, and the description, which wraps.
const AccessLine: Component<AccessLineProps> = (props) => (
  <div class="flex min-w-0 items-start gap-1 px-1 py-1 leading-6">
    <div class="flex h-6 w-6 shrink-0 items-center justify-center">
      <div class={clsx("h-5 w-5 text-gray-400", props.icon)} />
    </div>
    <div class="flex min-w-0 flex-1 items-start gap-1.5">
      <span class="shrink-0 text-gray-500">{props.label}</span>
      <div class="h-6 w-px flex items-center justify-center">
        <div class="h-4 w-px shrink-0 rounded-full bg-gray-200" />
      </div>
      <span class="min-w-0 flex-1 font-medium text-gray-700">{props.children}</span>
    </div>
  </div>
);
// Inline, so the list reads and wraps as one sentence; items are single elements for hydration.
const PermissionList: Component<PermissionListProps> = (props) => (
  <span>
    <For each={props.permissions}>
      {(permission, index) => {
        const blocked = () => Boolean(props.canGrant && !props.canGrant(permission));

        return (
          <span>
            {index() > 0 ? ", " : ""}
            <span
              class={clsx(blocked() && "text-red-500")}
              title={blocked() ? "You can't give this permission" : undefined}
            >
              {index() > 0
                ? lowerFirst(describeExtensionPermission(permission))
                : describeExtensionPermission(permission)}
            </span>
          </span>
        );
      }}
    </For>
  </span>
);

/**
 * What an extension can do, in plain words: its permissions and whether it sends workspace data
 * to its developer. With `changes`, only what an update adds.
 */
const AccessSummary: Component<AccessSummaryProps> = (props) => (
  <Show
    when={props.changes}
    fallback={
      <>
        <AccessLine icon="i-lucide:key-round" label="Permissions">
          <Show
            when={props.grant.permissions.length}
            fallback="Doesn't read or change workspace content"
          >
            <PermissionList permissions={props.grant.permissions} canGrant={props.canGrant} />
          </Show>
        </AccessLine>
        <Show when={props.grant.backendURL}>
          {(url) => (
            <AccessLine icon="i-lucide:globe" label="External service">
              {getURLHost(url())}
            </AccessLine>
          )}
        </Show>
      </>
    }
  >
    {(changes) => (
      <>
        <Show when={changes().permissions.length}>
          <AccessLine icon="i-lucide:key-round" label="New permissions">
            <PermissionList permissions={changes().permissions} canGrant={props.canGrant} />
          </AccessLine>
        </Show>
        <Show when={changes().backendURL}>
          {(url) => (
            <AccessLine icon="i-lucide:globe" label="New external service">
              {getURLHost(url())}
            </AccessLine>
          )}
        </Show>
        <Show when={changes().requests.length}>
          <AccessLine icon="i-lucide:link" label="New connections">
            {formatHosts(changes().requests)}
          </AccessLine>
        </Show>
      </>
    )}
  </Show>
);

export { AccessSummary };
