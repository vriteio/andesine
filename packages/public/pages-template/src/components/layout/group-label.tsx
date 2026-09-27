import type { BreadcrumbItem } from "@andesine/pages";
import { Breadcrumbs } from "@andesine/ui/solid";
import { type Component, Show } from "solid-js";

interface GroupLabelProps {
  group: BreadcrumbItem;
}

const labelClass = "bg-gradient-to-tr bg-[length:125%_auto] bg-clip-text text-transparent";

/** The direct parent group of the page. */
const GroupLabel: Component<GroupLabelProps> = (props) => (
  <Breadcrumbs.Root>
    <Breadcrumbs.List class="flex text-sm font-semibold">
      <Breadcrumbs.Item class="min-w-0 truncate">
        <Show
          when={props.group.href}
          fallback={<Breadcrumbs.Label class={labelClass}>{props.group.label}</Breadcrumbs.Label>}
        >
          {(href) => (
            <Breadcrumbs.Link
              href={href()}
              class={`${labelClass} decoration-tertiary underline-offset-4 @hover:underline focus-visible:underline`}
            >
              {props.group.label}
            </Breadcrumbs.Link>
          )}
        </Show>
      </Breadcrumbs.Item>
    </Breadcrumbs.List>
  </Breadcrumbs.Root>
);

export { GroupLabel };
