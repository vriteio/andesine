import { DropdownArea } from "@andesine/components";
import { type Component, Show } from "solid-js";
import { createNodeViewRenderer, type NodeViewComponentProps } from "#editor/lib";
import { isOptionalField } from "#editor/lib/optional-fields";
import { InheritedSchemaFieldBadge } from "#editor/ui/inherited-schema-field-badge";
import { FragmentMenu, type FragmentAttrs } from "./menu";

interface FragmentViewProps extends NodeViewComponentProps<FragmentAttrs> {
  schemaMode: boolean;
}
const FragmentView: Component<FragmentViewProps> = (props) => {
  const attrs = () => props.node().attrs as FragmentAttrs;
  const schemaEnforced = () => !props.schemaMode && Boolean(attrs().schemaFieldID);
  const editable = () => {
    const configurable = !schemaEnforced() || isOptionalField(props.editor, attrs().schemaFieldID);

    return props.editable() && !attrs().inherited && configurable;
  };

  return (
    <div
      class={attrs().inherited ? "relative select-none" : "relative"}
      data-inherited-schema-field={attrs().inherited ? "" : undefined}
      aria-readonly={attrs().inherited ? "true" : undefined}
    >
      <Show when={attrs().inherited}>
        <InheritedSchemaFieldBadge />
      </Show>
      <Show
        when={editable()}
        fallback={
          <div
            class="flex h-9 w-full items-center gap-1 text-sm font-medium"
            data-fragment-header
            data-block-control-anchor
            contentEditable={false}
          >
            <span class="i-lucide:letter-text h-4.5 w-4.5 shrink-0 text-gray-300" />
            <span class="min-w-0 truncate text-gray-500 mr-1">{attrs().name || "Content"}</span>
            <Show when={props.schemaMode && !attrs().optional}>
              <span
                class="-ml-2 mr-1 mb-1 shrink-0 font-mono text-xs text-red-500"
                aria-label="Required"
              >
                *
              </span>
            </Show>
            <span class="h-px flex-1 rounded-full bg-gray-200" />
          </div>
        }
      >
        <DropdownArea>
          <FragmentMenu
            attrs={attrs()}
            editor={props.editor}
            getPos={props.getPos}
            schemaMode={props.schemaMode}
            schemaEnforced={schemaEnforced()}
            selected={props.selected()}
            deleteFragment={props.deleteNode}
            selectFragment={props.select}
            updateAttributes={props.updateAttributes}
          />
        </DropdownArea>
      </Show>
      <div
        ref={(element) => {
          if (props.contentDOM) element.appendChild(props.contentDOM);
        }}
        class="contents"
        contentEditable={attrs().inherited ? false : undefined}
      />
    </div>
  );
};
const createFragmentViewRenderer = (
  owner: unknown,
  editable: () => boolean,
  schemaMode = false
) => {
  const Renderer: Component<NodeViewComponentProps<FragmentAttrs>> = (props) => (
    <FragmentView {...props} schemaMode={schemaMode} />
  );

  return createNodeViewRenderer(Renderer, {
    content: true,
    attributes: {
      "data-node-view": "true",
      "data-fragment-node-view": ""
    },
    contentAttributes: {
      "data-node-view-content": "true"
    },
    ignoreMutation(mutation, context) {
      return !context.contentDOM?.contains(mutation.target);
    },
    stopEvent(event, context) {
      if (context.node().attrs.inherited) return true;
      if (event instanceof DragEvent) return false;

      return !context.contentDOM?.contains(event.target as globalThis.Node);
    }
  })(owner, editable);
};

export { createFragmentViewRenderer };
