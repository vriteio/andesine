import type { NodeViewRendererProps } from "@tiptap/core";
import { createScrollShadowController, ScrollShadow } from "@andesine/components";
import { TableView } from "@tiptap/extension-table";
import type { NodeView } from "@tiptap/pm/view";
import { type Accessor, createSignal, type Owner } from "solid-js";
import { render } from "solid-js/web";
import { TableControls } from "./controls";
import { createTableViewport } from "./viewport";
import { createTableDiffView } from "#editor/extensions/version-diff/table";

const createTableViewRenderer = (owner: unknown, editable: Accessor<boolean>) => {
  return (props: NodeViewRendererProps): NodeView => {
    const view = new TableView(props.node, 80, props.view, props.HTMLAttributes);
    const shadowController = createScrollShadowController();
    const viewport = createTableViewport(props.editor, view, () => {
      shadowController.processScrollState();
      diff.refresh();
    });
    const diff = createTableDiffView(props.editor, viewport.dom, viewport.scrollContainer, owner);
    const controls = document.createElement("div");
    const [node, setNode] = createSignal(props.node);

    controls.setAttribute("data-menu", "");
    controls.contentEditable = "false";
    controls.className = "absolute inset-0 pointer-events-none z-10 not-prose";
    view.dom.appendChild(controls);
    diff.update(props.decorations);

    const unmount = render(
      () => <TableControls {...props} node={node} editable={editable} view={view} />,
      controls,
      undefined,
      { owner: owner as Owner }
    );
    const unmountShadows = render(
      () => (
        <ScrollShadow
          direction="horizontal"
          scrollableContainerRef={() => viewport.scrollContainer}
          controller={shadowController}
        />
      ),
      viewport.shadows,
      undefined,
      { owner: owner as Owner }
    );

    return {
      dom: viewport.dom,
      contentDOM: view.contentDOM,
      ignoreMutation: (mutation) => {
        if (mutation.type !== "selection" && !view.contentDOM.contains(mutation.target)) {
          return true;
        }

        return view.ignoreMutation(mutation);
      },
      stopEvent: (event) =>
        event.target instanceof window.Node &&
        (controls.contains(event.target) || diff.badge.contains(event.target)),
      update(updatedNode, decorations) {
        if (!view.update(updatedNode)) return false;

        setNode(updatedNode);
        diff.update(decorations);
        return true;
      },
      destroy() {
        viewport.destroy();
        diff.destroy();
        unmount();
        unmountShadows();
      }
    };
  };
};

export { createTableViewRenderer };
