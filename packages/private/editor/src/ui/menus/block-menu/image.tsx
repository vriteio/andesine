import { ImageURLInput } from "#editor/ui/views/image-view/url-input";
import { Input, type MenuItem } from "@andesine/components";
import type { Editor } from "@tiptap/core";
import { createSignal } from "solid-js";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { isPositionInInheritedField } from "#editor/ui/block-utils";

interface ImageFieldProps {
  label: string;
  placeholder: string;
  value(): string;
  commit(value: string): void;
}

const ImageField = (props: ImageFieldProps) => {
  const [value, setValue] = createSignal(props.value());

  let committedValue = value();

  const commit = () => {
    const nextValue = value();

    if (nextValue === committedValue) return;
    if (nextValue !== props.value()) props.commit(nextValue);

    committedValue = nextValue;
  };

  return (
    <div class="w-full min-w-0 p-1" data-image-menu-input>
      <Input
        class="w-full min-w-0 bg-gray-50"
        label={props.label}
        placeholder={props.placeholder}
        size="small"
        color="contrast"
        variant="outlined"
        maxLength={2000}
        value={value()}
        setValue={setValue}
        onConfirm={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
};
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
        <ImageField
          label="Alt text"
          placeholder="Describe the image"
          value={() => getCurrentImage()?.attrs.alt || ""}
          commit={(value) => update("alt", value)}
        />
      ),
      () => (
        <ImageField
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
              icon: "i-lucide:search",
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
