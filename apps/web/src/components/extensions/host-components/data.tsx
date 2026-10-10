import { Card, IconButton, Skeleton, Spinner, Tooltip } from "@andesine/components";
import { isDeclaredURL } from "#web/lib/extensions";
import { TimeAgo } from "#web/components/time-ago";
import { useClipboard } from "#web/context/clipboard";
import clsx from "clsx";
import { createEffect, createSignal, For, Show } from "solid-js";
import { type HostComponents } from "./types";

const calloutClasses = {
  info: "border-gray-300",
  warning: "border-orange-400",
  danger: "border-red-500",
  success: "border-green-500"
};
const skeletonHeights = { small: "h-4", medium: "h-8", large: "h-24" };
const dataComponents: Pick<
  HostComponents,
  | "List"
  | "Card"
  | "Tabs"
  | "Tab"
  | "Disclosure"
  | "Callout"
  | "Steps"
  | "Step"
  | "Figure"
  | "CodeBlock"
  | "TimeAgo"
  | "Spinner"
  | "Skeleton"
> = {
  List: (props) => (
    <div class="flex min-w-0 flex-col gap-1">
      <For
        each={props.childNodes()}
        fallback={<span class="text-xs text-gray-400">{props.props.emptyLabel ?? "No items"}</span>}
      >
        {(child, index) => (
          <div class="group/item flex min-w-0 items-start gap-1">
            <div class="min-w-0 flex-1">{props.renderNode(child.id)}</div>
            <Show when={!props.props.disabled}>
              <div class="flex shrink-0 gap-0.5 media-mouse:opacity-0 media-mouse:group-hover/item:opacity-100">
                <IconButton
                  variant="ghost"
                  text="base"
                  icon="i-lucide:arrow-up"
                  aria-label="Move up"
                  disabled={index() === 0}
                  onClick={() => props.emit("onMove", index(), index() - 1)}
                />
                <IconButton
                  variant="ghost"
                  text="base"
                  icon="i-lucide:arrow-down"
                  aria-label="Move down"
                  disabled={index() === props.childNodes().length - 1}
                  onClick={() => props.emit("onMove", index(), index() + 1)}
                />
                <IconButton
                  variant="ghost"
                  text="base"
                  icon="i-lucide:trash-2"
                  aria-label="Remove"
                  onClick={() => props.emit("onRemove", index())}
                />
              </div>
            </Show>
          </div>
        )}
      </For>
      <Show when={!props.props.disabled}>
        <button
          type="button"
          class="flex items-center gap-1 self-start text-sm text-gray-500 hover:text-gray-700"
          onClick={() => props.emit("onAdd")}
        >
          <div class="i-lucide:plus h-4 w-4" />
          {props.props.addLabel ?? "Add"}
        </button>
      </Show>
    </div>
  ),
  Card: (props) => (
    <Card color={props.props.color ?? "base"} class="m-0 flex min-w-0 flex-col gap-2">
      {props.children}
    </Card>
  ),
  // Uncontrolled unless the extension updates `value`; changes are also reported.
  Tabs: (props) => {
    const [active, setActive] = createSignal(props.props.value);
    const tabs = () => props.childNodes().filter((child) => child.component === "Tab");
    const activeTab = () => tabs().find((tab) => tab.props.value === active()) ?? tabs()[0];

    createEffect(() => setActive(props.props.value));

    return (
      <div class="flex min-w-0 flex-col gap-2">
        <div role="tablist" class="flex gap-3 border-b border-gray-200">
          <For each={tabs()}>
            {(tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === activeTab()}
                class={clsx(
                  "-mb-px border-b-2 pb-1 text-sm",
                  tab === activeTab()
                    ? "border-current font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
                onClick={() => {
                  setActive(tab.props.value as string);
                  props.emit("onChange", tab.props.value);
                }}
              >
                {tab.props.label as string}
              </button>
            )}
          </For>
        </div>
        <Show when={activeTab()} keyed>
          {(tab) => props.renderNode(tab.id)}
        </Show>
      </div>
    );
  },
  Tab: (props) => (
    <div role="tabpanel" class="flex min-w-0 flex-col gap-2">
      {props.children}
    </div>
  ),
  Disclosure: (props) => {
    const [open, setOpen] = createSignal(props.props.open ?? false);

    return (
      <div class="flex min-w-0 flex-col">
        <button
          type="button"
          aria-expanded={open()}
          class="flex items-center gap-1 py-1 text-left text-sm font-medium"
          onClick={() => setOpen(!open())}
        >
          <div
            class={clsx(
              "i-lucide:chevron-right h-4 w-4 transition-transform",
              open() && "rotate-90"
            )}
          />
          {props.props.label}
        </button>
        <Show when={open()}>
          <div class="flex min-w-0 flex-col gap-2 pl-5">{props.children}</div>
        </Show>
      </div>
    );
  },
  Callout: (props) => (
    <div
      class={clsx(
        "flex min-w-0 flex-col gap-1 rounded-r-lg border-l-2 bg-gray-50 px-3 py-2 text-sm",
        calloutClasses[props.props.tone ?? "info"]
      )}
    >
      <Show when={props.props.title}>
        <span class="font-medium">{props.props.title}</span>
      </Show>
      {props.children}
    </div>
  ),
  Steps: (props) => (
    <ol class="flex min-w-0 flex-col gap-3">
      <For each={props.childNodes()}>
        {(child, index) => (
          <li class="flex min-w-0 gap-2">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium">
              {index() + 1}
            </span>
            <div class="min-w-0 flex-1">{props.renderNode(child.id)}</div>
          </li>
        )}
      </For>
    </ol>
  ),
  Step: (props) => (
    <div class="flex min-w-0 flex-col gap-1">
      <span class="text-sm font-medium leading-6">{props.props.title}</span>
      {props.children}
    </div>
  ),
  Figure: (props) => (
    <figure class="flex min-w-0 flex-col gap-1">
      <Show
        when={isDeclaredURL(props.props.src, props.sources)}
        fallback={
          <div class="rounded-lg bg-gray-100 p-4 text-center text-xs text-gray-500">
            {props.props.alt}
          </div>
        }
      >
        <img
          src={props.props.src}
          alt={props.props.alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          class="max-w-full rounded-lg"
        />
      </Show>
      <Show when={props.props.caption}>
        <figcaption class="text-xs text-gray-500">{props.props.caption}</figcaption>
      </Show>
    </figure>
  ),
  CodeBlock: (props) => {
    const { copyText } = useClipboard();

    return (
      <div class="group/code relative min-w-0">
        <pre class="overflow-x-auto rounded-lg bg-gray-100 p-3 font-mono text-xs">
          <code>{props.props.code}</code>
        </pre>
        <div class="absolute right-1 top-1 media-mouse:opacity-0 media-mouse:group-hover/code:opacity-100">
          <Tooltip content="Copy">
            <IconButton
              variant="ghost"
              text="base"
              icon="i-lucide:copy"
              aria-label="Copy"
              onClick={() => copyText(props.props.code)}
            />
          </Tooltip>
        </div>
      </div>
    );
  },
  TimeAgo: (props) => <TimeAgo date={props.props.date} class="text-sm text-gray-500" />,
  Spinner: (props) => <Spinner size={props.props.size ?? "small"} />,
  Skeleton: (props) => (
    <Skeleton class={clsx("w-full rounded-lg", skeletonHeights[props.props.height ?? "small"])} />
  )
};

export { dataComponents };
