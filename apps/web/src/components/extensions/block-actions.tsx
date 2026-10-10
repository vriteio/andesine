import { type ExtensionBlockAction } from "@andesine/contracts/extensions";
import {
  type BlockActionOrigin,
  type BlockActions,
  type BlockActionTarget
} from "@andesine/editor";
import { useNotify } from "#web/context/notifications";
import { runningExtensions, type RunningExtension } from "#web/lib/extensions";
import { type Component, createEffect, createSignal, Show } from "solid-js";
import { BlockActionContext } from "./block-action-context";
import { ExtensionView } from "./extension-view";
import { ScopedIcon } from "./scoped-icon";

interface OpenBlockAction {
  extension: RunningExtension;
  action: ExtensionBlockAction;
  target: BlockActionTarget;
  viewID: string;
  /** Where the block menu was; null on narrow screens. */
  origin: BlockActionOrigin | null;
  /** Ends the menu's pending state; the action may still run, e.g. in a dialog. */
  settle(): void;
  /** Runs on without UI, e.g. after a menu choice, with the time limit again. */
  continueWithoutUI(): void;
  cleanup(): void;
}

type ViewProps = NonNullable<Parameters<RunningExtension["host"]["createView"]>[1]>;

const MAX_CONTEXT_SIZE = 100_000;
const RUN_TIMEOUT = 30_000;
// The view tree allows only one of these at a block action view's root.
const PRESENTATIONS = ["Dialog", "Menu"];

// Whether the view shows its `Dialog` or `Menu`.
const isPresented = (open: OpenBlockAction): boolean => {
  const { state } = open.extension.host.tree;

  return Boolean(state.nodes[state.roots[open.viewID]]?.children.length);
};

/**
 * Block menu actions of running extensions. An action's view starts without UI and edits only
 * the selected blocks; its root can show one `Dialog` or `Menu`.
 */
const createBlockActions = () => {
  const notify = useNotify();
  const [current, setCurrent] = createSignal<OpenBlockAction | null>(null);
  const close = () => {
    const open = current();

    if (!open) return;

    setCurrent(null);
    open.cleanup();
    open.settle();
    open.extension.host.disposeView(open.viewID);
    open.target.release();
  };
  const fail = (open: OpenBlockAction, text: string) => {
    notify({ type: "error", text });

    if (current() === open) close();
  };
  const open = (
    extension: RunningExtension,
    action: ExtensionBlockAction,
    target: BlockActionTarget,
    origin: BlockActionOrigin | null
  ): Promise<void> => {
    const props = { blocks: target.blocks } as ViewProps;

    close();

    if (JSON.stringify(props).length > MAX_CONTEXT_SIZE) {
      target.release();
      notify({ type: "error", text: "The selection is too large for this action" });

      return Promise.resolve();
    }

    const viewID = extension.host.createView(action.entry, props);

    extension.host.tree.restrictRoot(viewID, PRESENTATIONS);

    // A rejected edit also rejects the extension's request; the member learns why here.
    const edit = (applied: boolean) => {
      if (!applied) notify({ type: "error", text: `${action.label} couldn't edit the blocks` });

      return applied;
    };

    // Choosing the action is the member's interaction, e.g. for copying a result right away.
    extension.host.recordInteraction();
    extension.host.setViewTarget(viewID, {
      replace: (content) => edit(target.replace(content as never)),
      insertAfter: (content) => edit(target.insertAfter(content as never)),
      close
    });

    return new Promise((resolve) => {
      const opened: OpenBlockAction = {
        extension,
        action,
        target,
        viewID,
        origin,
        settle() {
          clearTimeout(timeout);
          resolve();
        },
        continueWithoutUI() {
          clearTimeout(timeout);
          timeout = startTimeout();
        },
        cleanup() {
          clearTimeout(timeout);
          offViewError();
        }
      };
      // Only actions without UI time out; dialogs and menus wait for the member.
      const startTimeout = () => {
        return setTimeout(() => {
          fail(opened, `${action.label} took too long and was stopped`);
        }, RUN_TIMEOUT);
      };

      let timeout = startTimeout();

      const offViewError = extension.onViewError(viewID, () => {
        fail(opened, `${action.label} failed`);
      });

      setCurrent(opened);
    });
  };

  createEffect(() => {
    const open = current();
    const isInvalid = open && open.extension.host.tree.state.invalidViews[open.viewID];

    if (isInvalid) {
      fail(open, `${open.action.label} can only show a dialog or a menu`);
    } else if (open && isPresented(open)) {
      open.settle();
    }
  });
  createEffect(() => {
    const open = current();
    const isGone =
      open &&
      (!runningExtensions().includes(open.extension) || open.extension.status() === "failed");

    if (isGone) fail(open, `${open.action.label} stopped`);
  });

  const blockActions: BlockActions = {
    get(blockTypes) {
      return runningExtensions()
        .filter((extension) => extension.status() === "ready")
        .flatMap((extension) => {
          return extension.blockActions
            .filter((action) => blockTypes.every((type) => action.blocks.includes(type)))
            .map((action) => ({
              id: `${extension.extensionID}:${action.id}`,
              label: action.label,
              // Manifest icon CSS applies only inside the extension's icon scope.
              icon:
                action.icon &&
                (() => <ScopedIcon extension={extension.name} icon={action.icon!} />),
              run: (target: BlockActionTarget, origin: BlockActionOrigin | null) => {
                return open(extension, action, target, origin);
              }
            }));
        });
    }
  };
  // Hidden: the root `Dialog` or `Menu` shows in its own portal.
  const BlockActionView: Component = () => (
    <Show when={current()} keyed>
      {(open) => (
        <BlockActionContext.Provider
          value={{
            origin: open.origin,
            getBlocksRect: () => open.target.getRect(),
            continueWithoutUI: open.continueWithoutUI,
            close
          }}
        >
          <div class="hidden">
            <ExtensionView host={open.extension.host} viewID={open.viewID} />
          </div>
        </BlockActionContext.Provider>
      )}
    </Show>
  );

  return { blockActions, BlockActionView };
};

export { createBlockActions };
