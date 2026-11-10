import { ImageURLInput } from "#editor/ui/views/image-view/url-input";
import type { MenuItem } from "@andesine/components";
import type { Editor } from "@tiptap/core";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { isPositionInInheritedField } from "#editor/ui/block-utils";
import { MenuField } from "./menu-field";

const createImageMenuItems = (
  editor: Editor,
  closeMenu: () => void
): NonNullable<MenuItem["items"]> => {
  const { doc, selection } = editor.state;
  const node = doc.nodeAt(selection.from);

  if (
    !editor.isEditable ||
    !isBlockSelection(selection) ||
    selection.ranges.length !== 1 ||
    node?.type.name !== "image" ||
    selection.to !== selection.from + node.nodeSize ||
    isPositionInInheritedField(doc, selection.from)
  )
    return [];

  const getCurrentImage = () => {
    const current = editor.state.doc.nodeAt(editor.state.selection.from);

    return current?.type.name === "image" && current.attrs.id === node.attrs.id ? current : null;
  };
  const update = (name: "alt" | "caption", value: string) => {
    const pos = editor.state.selection.from;
    const current = getCurrentImage();

    if (!editor.isEditable || !current) return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, [name]: value })
    );
  };

  return [
    [
      () => (
        <MenuField
          label="Alt text"
          placeholder="Describe the image"
          value={() => getCurrentImage()?.attrs.alt || ""}
          commit={(value) => update("alt", value)}
        />
      ),
      () => (
        <MenuField
          label="Caption"
          placeholder="Add a caption"
          value={() => getCurrentImage()?.attrs.caption || ""}
          commit={(value) => update("caption", value)}
        />
      )
    ],
    [
      {
        label: node.attrs.assetID ? "Replace image" : "Upload image",
        icon: node.attrs.assetID ? "i-lucide:repeat" : "i-lucide:image-plus",
        get disabled() {
          const images = editor.extensionManager.extensions.find(({ name }) => name === "images")
            ?.options.images;

          return !images?.()?.enabled();
        },
        items: [
          [
            () => (
              <ImageURLInput
                onSubmit={(url) => {
                  const selected = editor.state.doc.nodeAt(editor.state.selection.from);

                  if (selected?.type.name !== "image" || selected.attrs.id !== node.attrs.id)
                    return;
                  const element = (
                    editor.view.nodeDOM(editor.state.selection.from) as HTMLElement | null
                  )?.querySelector("[data-image-block]");

                  if (!element) return;
                  element.dispatchEvent(new CustomEvent("image-upload", { detail: url }));
                  closeMenu();
                }}
              />
            )
          ],
          [
            {
              label: "Choose existing",
              icon: "i-tabler:search",
              get disabled() {
                const images = editor.extensionManager.extensions.find(
                  ({ name }) => name === "images"
                )?.options.images;

                return !images?.()?.renderPicker;
              },
              onClick: () => {
                const position = editor.state.selection.from;
                const selected = editor.state.doc.nodeAt(position);

                if (selected?.type.name !== "image" || selected.attrs.id !== node.attrs.id) return;
                const element = (
                  editor.view.nodeDOM(position) as HTMLElement | null
                )?.querySelector("[data-image-block]");

                closeMenu();
                element?.dispatchEvent(new CustomEvent("image-picker"));
              }
            },
            {
              label: "Upload file",
              icon: "i-lucide:upload",
              onClick: () => {
                const selected = editor.state.doc.nodeAt(editor.state.selection.from);

                if (selected?.type.name !== "image" || selected.attrs.id !== node.attrs.id) return;

                const input = (
                  editor.view.nodeDOM(editor.state.selection.from) as HTMLElement | null
                )?.querySelector<HTMLInputElement>("[data-image-upload]");

                input?.click();
              }
            }
          ]
        ]
      }
    ]
  ];
};

export { createImageMenuItems };
