import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { normalizeEntryTitle } from "../schema/title";
import { Tooltip } from "@andesine/components";
import { getOwner } from "solid-js";
import { render } from "solid-js/web";

interface TitleValidationOptions {
  validate(title: string): string | undefined;
  initialTitle(): string;
}
interface TitleValidationState {
  lastValid: string;
  error?: string;
}

const titleValidationKey = new PluginKey<TitleValidationState>("titleValidation");
const titleIsSelected = (state: EditorState): boolean => {
  const title = state.doc.firstChild;

  return (
    title?.type.name === "title" && state.selection.from < title.nodeSize && state.selection.to > 0
  );
};
const restoreInvalidTitle = (state: EditorState): Transaction | null => {
  const value = titleValidationKey.getState(state);
  const title = state.doc.firstChild;

  if (!value?.error || title?.type.name !== "title") return null;

  return state.tr.insertText(value.lastValid, 1, title.nodeSize - 1).setMeta("addToHistory", false);
};
const TitleValidation = Extension.create<TitleValidationOptions>({
  name: "titleValidation",
  addOptions() {
    return { validate: () => undefined, initialTitle: () => "Untitled" };
  },
  addProseMirrorPlugins() {
    const options = this.options;
    const editor = this.editor;
    const owner = getOwner();
    const tooltipCleanups = new WeakMap<Node, () => void>();

    return [
      new Plugin<TitleValidationState>({
        key: titleValidationKey,
        state: {
          init: (_, state) => {
            const title = normalizeEntryTitle(
              state.doc.firstChild?.textContent || options.initialTitle()
            );
            const error = options.validate(title);

            return { lastValid: error ? options.initialTitle() : title, error };
          },
          apply: (_, value, __, state) => {
            const title = normalizeEntryTitle(state.doc.firstChild?.textContent || "");
            const error = options.validate(title);

            return { lastValid: error ? value.lastValid : title, error };
          }
        },
        appendTransaction: (transactions, previous, current) => {
          if (!editor.isEditable || !titleValidationKey.getState(current)?.error) {
            return null;
          }
          if (
            transactions.some((transaction) => {
              return transaction.getMeta(titleValidationKey) === "restore";
            })
          ) {
            return null;
          }

          const leftTitle = titleIsSelected(previous) && !titleIsSelected(current);
          const blurred = transactions.some((transaction) => {
            return transaction.getMeta(titleValidationKey) === "blur";
          });
          const transaction = leftTitle || blurred ? restoreInvalidTitle(current) : null;

          return transaction?.setMeta(titleValidationKey, "restore") || null;
        },
        props: {
          handleDOMEvents: {
            blur: (view) => {
              if (editor.isEditable && titleValidationKey.getState(view.state)?.error) {
                view.dispatch(view.state.tr.setMeta(titleValidationKey, "blur"));
              }

              return false;
            }
          },
          decorations: (state) => {
            const error = titleValidationKey.getState(state)?.error;
            const title = state.doc.firstChild;

            if (!editor.isEditable || !error || title?.type.name !== "title") {
              return null;
            }

            return DecorationSet.create(state.doc, [
              Decoration.node(0, title.nodeSize, {
                "class": "relative",
                "aria-invalid": "true"
              }),
              Decoration.widget(
                title.nodeSize - 1,
                () => {
                  const indicator = document.createElement("span");

                  indicator.contentEditable = "false";
                  indicator.className =
                    "absolute -right-9 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 p-1 text-red-500";
                  indicator.setAttribute("role", "img");
                  indicator.setAttribute("aria-label", error);
                  indicator.setAttribute("data-title-error", "");

                  const cleanup = render(
                    () => (
                      <Tooltip
                        content={error}
                        placement="left"
                        offset={{ mainAxis: 12 }}
                        wrapperClass="h-full w-full"
                        fixed
                      >
                        <span class="h-5 w-5 i-lucide:triangle-alert" aria-hidden="true" />
                      </Tooltip>
                    ),
                    indicator,
                    undefined,
                    { owner: owner || undefined }
                  );

                  tooltipCleanups.set(indicator, cleanup);
                  return indicator;
                },
                {
                  key: error,
                  side: 1,
                  destroy: (node) => {
                    tooltipCleanups.get(node)?.();
                    tooltipCleanups.delete(node);
                  }
                }
              )
            ]);
          }
        }
      })
    ];
  }
});

export { TitleValidation, titleValidationKey };
