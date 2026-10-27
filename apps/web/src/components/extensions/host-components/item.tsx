import clsx from "clsx";
import { type Component, createEffect, createSignal, For, on, Show } from "solid-js";
import { TimeAgo } from "#web/components/time-ago";
import { type HostComponentProps, iconToneClasses } from "./types";

/**
 * A row, as the app's version rows; clickable when it has `onClick`. With an `ItemDetails` child,
 * a click opens and closes the details under it, as the app's webhook events.
 */
const ExtensionItem: Component<HostComponentProps<"Item">> = (props) => {
  const [open, setOpen] = createSignal(false);
  const detailsNode = () => props.childNodes().find(({ component }) => component === "ItemDetails");
  const actionNodes = () =>
    props.childNodes().filter(({ component }) => component !== "ItemDetails");
  // The second line: the details, after the date unless the date is at the end of the label line.
  const hasDetails = () => {
    return Boolean((!detailsNode() && props.props.date) || props.props.details?.length);
  };
  const isClickable = () => {
    return !props.props.disabled && (props.hasEvent("onClick") || Boolean(detailsNode()));
  };
  const click = () => {
    if (!isClickable()) return;
    if (detailsNode()) setOpen((current) => !current);
    if (props.hasEvent("onClick")) props.emit("onClick");
  };

  // Details that ask to be open at first, e.g. a failed build's, open once they show.
  createEffect(
    on(
      () => detailsNode()?.id,
      (id) => id !== undefined && setOpen(Boolean(detailsNode()?.props.open))
    )
  );

  return (
    <div class="flex min-w-0 flex-col">
      <div
        role={isClickable() ? "button" : undefined}
        tabIndex={isClickable() ? 0 : undefined}
        aria-expanded={detailsNode() ? open() : undefined}
        aria-disabled={props.props.disabled || undefined}
        class={clsx(
          "group relative flex w-full min-w-0 select-none items-center gap-1 rounded-lg pl-0.5 text-left font-medium focus:outline-none",
          // As tall as a version row with details, or a menu row without.
          hasDetails() ? "min-h-11" : "min-h-7",
          isClickable() &&
            "cursor-pointer @hover:bg-gradient-to-r @hover:from-gray-500/10 @hover:to-transparent focus-visible:bg-gradient-to-r focus-visible:from-gray-500/10 focus-visible:to-transparent",
          props.props.disabled && "opacity-50"
        )}
        onClick={click}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            click();
          }
        }}
      >
        <div
          class={clsx(
            "flex h-6 w-6 shrink-0 items-center justify-center",
            hasDetails() && "self-start mt-0.5"
          )}
        >
          {/* Icon classes come from the extension's generated CSS. */}
          <div
            class={clsx(
              "h-5 w-5",
              props.props.icon ?? "i-lucide:circle",
              iconToneClasses[props.props.tone ?? "muted"]
            )}
          />
        </div>
        <div class="flex min-w-0 flex-1 flex-col leading-tight">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="min-w-0 flex-1 line-clamp-1">{props.props.label}</span>
            {/* Records that open, e.g. builds, have the time at the end, as webhook events. */}
            <Show when={detailsNode() && props.props.date}>
              {(date) => (
                <TimeAgo
                  class="shrink-0 text-xs font-normal text-gray-400"
                  date={date()}
                  offset={{ mainAxis: 8 }}
                  placement="bottom-end"
                />
              )}
            </Show>
          </div>
          <Show when={hasDetails()}>
            <div class="flex w-full min-w-0 items-center gap-1 text-left text-xs font-normal text-gray-400">
              <Show when={!detailsNode() && props.props.date}>
                {(date) => (
                  <TimeAgo
                    class="shrink-0 !items-start !justify-start"
                    date={date()}
                    offset={{ mainAxis: 8 }}
                    placement="bottom-start"
                  />
                )}
              </Show>
              <For each={props.props.details}>
                {(detail, index) => (
                  <>
                    <Show when={(!detailsNode() && props.props.date) || index() > 0}>
                      <span class="h-3 w-px shrink-0 bg-gray-400 opacity-20" />
                    </Show>
                    <span class="min-w-0 truncate" title={detail}>
                      {detail}
                    </span>
                  </>
                )}
              </For>
            </div>
          </Show>
        </div>
        <Show when={actionNodes().length > 0}>
          {/* Actions are their own targets, so they don't also click the row. */}
          <div
            class="flex shrink-0 items-center self-start opacity-20 media-mouse:opacity-0 media-mouse:group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <For each={actionNodes()}>{(node) => props.renderNode(node.id)}</For>
          </div>
        </Show>
      </div>
      <Show when={open() && detailsNode()}>{(node) => props.renderNode(node().id)}</Show>
    </div>
  );
};
/**
 * An opened `Item`'s details: a line from its icon, as the app's webhook event details. Long words,
 * e.g. paths in an error, wrap anywhere, so they don't widen the page.
 */
const ExtensionItemDetails: Component<HostComponentProps<"ItemDetails">> = (props) => (
  <div class="flex">
    <div class="flex min-w-3.5 justify-end pl-0.5">
      <div class="-mt-4 h-[calc(100%+1rem)] w-px rounded-full bg-gray-300" />
    </div>
    <div class="my-1 flex min-w-0 flex-1 flex-col gap-2 pl-3 [overflow-wrap:anywhere] [&>*]:min-w-0">
      {props.children}
    </div>
  </div>
);

export { ExtensionItem, ExtensionItemDetails };
