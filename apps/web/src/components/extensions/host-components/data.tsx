import { Card, IconButton, Skeleton, Spinner, Tooltip } from "@andesine/components";
import { isDeclaredURL, type ExtensionTreeNode } from "#web/lib/extensions";
import { TimeAgo } from "#web/components/time-ago";
import { useClipboard } from "#web/context/clipboard";
import clsx from "clsx";
import { createEffect, createSignal, For, Show } from "solid-js";
import { type HostComponents } from "./types";

// As the app's notices, e.g. on an extension's settings page: the tone is only the icon's.
const calloutIcons = {
  info: "i-lucide:info text-gray-400",
  warning: "i-lucide:triangle-alert text-amber-500",
  danger: "i-lucide:circle-alert text-red-500",
  success: "i-lucide:circle-check text-green-500"
};
const CALLOUT_ACTIONS = new Set(["Button", "IconButton"]);
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
        fallback={
          // As the app's empty lists, e.g. "No webhooks".
          <Card
            class="m-0 flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
            shade
          >
            <Show when={props.props.emptyIcon}>
              {(icon) => <div class={clsx("h-5.5 w-5.5 text-gray-300", icon())} />}
            </Show>
            {props.props.emptyLabel ?? "No items"}
          </Card>
        }
      >
        {(child, index) => (
          <div class="group/item flex min-w-0 items-start gap-1">
            <div class="min-w-0 flex-1">{props.renderNode(child.id)}</div>
            <Show when={!props.props.disabled}>
              <div class="flex shrink-0 gap-0.5 media-mouse:opacity-0 media-mouse:group-hover/item:opacity-100">
                <Tooltip content="Move up">
                  <IconButton
                    variant="ghost"
                    text="base"
                    icon="i-lucide:arrow-up"
                    aria-label="Move up"
                    disabled={index() === 0}
                    onClick={() => props.emit("onMove", index(), index() - 1)}
                  />
                </Tooltip>
                <Tooltip content="Move down">
                  <IconButton
                    variant="ghost"
                    text="base"
                    icon="i-lucide:arrow-down"
                    aria-label="Move down"
                    disabled={index() === props.childNodes().length - 1}
                    onClick={() => props.emit("onMove", index(), index() + 1)}
                  />
                </Tooltip>
                <Tooltip content="Remove">
                  <IconButton
                    variant="ghost"
                    text="base"
                    icon="i-lucide:trash-2"
                    aria-label="Remove"
                    onClick={() => props.emit("onRemove", index())}
                  />
                </Tooltip>
              </div>
            </Show>
          </div>
        )}
      </For>
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
  // Button children are the actions, on the right; the other children are the text.
  Callout: (props) => {
    const isAction = (node: ExtensionTreeNode) => CALLOUT_ACTIONS.has(node.component);
    const text = () => props.childNodes().filter((node) => !isAction(node));
    const actions = () => props.childNodes().filter(isAction);

    return (
      // One row that wraps by its own width, not the screen's, e.g. in a narrow panel.
      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-gray-100 p-1 pl-1.5 text-sm">
        {/* At the top, in line with the title; as far from the top as from the left (6px). */}
        <div
          class={clsx(
            "mt-0.5 h-5 w-5 shrink-0 self-start",
            calloutIcons[props.props.tone ?? "info"]
          )}
        />
        <div class="min-w-0 flex-1 basis-40 py-0.5">
          <Show when={props.props.title}>
            <p class="font-medium">{props.props.title}</p>
          </Show>
          <For each={text()}>{(node) => props.renderNode(node.id)}</For>
        </div>
        <Show when={actions().length}>
          <div class="ml-auto flex shrink-0 justify-end gap-1">
            <For each={actions()}>{(node) => props.renderNode(node.id)}</For>
          </div>
        </Show>
      </div>
    );
  },
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
      // No width of its own: long lines scroll inside it instead of widening the page.
      <div class="group/code relative min-w-0 [contain:inline-size]">
        {/* A log is plain, as the app's webhook payloads: no box, at most 60% of the window high. */}
        <pre
          class={clsx(
            "font-mono text-xs",
            props.props.log
              ? "max-h-[60vh] overflow-auto whitespace-pre scrollbar-sm"
              : "overflow-x-auto rounded-lg bg-gray-100 p-3"
          )}
        >
          <code>{props.props.code}</code>
        </pre>
        <div
          class={clsx(
            "absolute media-mouse:opacity-0 media-mouse:group-hover/code:opacity-100",
            props.props.log ? "right-0 top-0" : "right-1 top-1"
          )}
        >
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
  Spinner: (props) => <Spinner size="small" class={props.props.class} />,
  Skeleton: (props) => <Skeleton class={clsx(":base: h-4 w-full rounded-lg", props.props.class)} />
};

export { dataComponents };
