import { CellSelection, cellAround, tableEditingKey, TableMap, type Rect } from "@tiptap/pm/tables";
import { type Accessor, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { TableControlsProps } from "./types";

const createTableInteractionState = (props: TableControlsProps, interacting: Accessor<boolean>) => {
  const [selectedCells, setSelectedCells] = createSignal<Rect | null>(null);
  const [selectingCells, setSelectingCells] = createSignal(false);
  const update = () => {
    const { selection } = props.editor.state;
    const selecting = tableEditingKey.getState(props.editor.state) != null;
    const anchor =
      selection instanceof CellSelection ? selection.$anchorCell : cellAround(selection.$from);
    const head =
      selection instanceof CellSelection ? selection.$headCell : cellAround(selection.$to);
    const pos = props.getPos();

    setSelectingCells(selecting);
    props.view.dom.toggleAttribute("data-table-selecting-cells", selecting);
    if (
      typeof pos === "number" &&
      anchor &&
      head &&
      anchor.start(-1) === pos + 1 &&
      head.start(-1) === pos + 1
    ) {
      setSelectedCells(
        TableMap.get(props.node()).rectBetween(anchor.pos - pos - 1, head.pos - pos - 1)
      );
    } else {
      setSelectedCells(null);
    }
  };
  const preventNativeSelection = (event: Event) => {
    if (interacting()) event.preventDefault();
  };

  createEffect(() => {
    props.view.dom.toggleAttribute("data-table-interacting", interacting());
  });
  onMount(() => {
    update();
    props.editor.on("transaction", update);
    document.addEventListener("selectstart", preventNativeSelection, true);
    onCleanup(() => {
      props.editor.off("transaction", update);
      document.removeEventListener("selectstart", preventNativeSelection, true);
      props.view.dom.removeAttribute("data-table-selecting-cells");
      props.view.dom.removeAttribute("data-table-interacting");
    });
  });

  return { selectedCells, selectingCells };
};

export { createTableInteractionState };
