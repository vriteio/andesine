import { type RunningExtension } from "#web/lib/extensions";
import { createEffect, createSignal, on, onCleanup } from "solid-js";

type ViewProps = NonNullable<Parameters<RunningExtension["host"]["createView"]>[1]>;

/**
 * A view of a running extension, e.g. a panel's or a page's: created at once, updated when the
 * context's IDs change, and disposed with its owner.
 */
const useExtensionView = (
  extension: RunningExtension,
  view: string,
  context: () => Record<string, string>
) => {
  const { host } = extension;
  const [failed, setFailed] = createSignal(false);
  const viewID = host.createView(view, context() as ViewProps);
  const rendered = () => {
    const root = host.tree.state.roots[viewID];

    return root !== undefined && host.tree.state.nodes[root]?.children.length > 0;
  };
  const unavailable = () => failed() || extension.status() === "failed";

  onCleanup(extension.onViewError(viewID, () => setFailed(true)));
  onCleanup(() => host.disposeView(viewID));
  // Sends the context only when its IDs change, not on every recomputation.
  createEffect(
    on(
      () => JSON.stringify(context()),
      () => host.updateView(viewID, context() as ViewProps),
      { defer: true }
    )
  );

  return { viewID, rendered, unavailable };
};

export { useExtensionView };
