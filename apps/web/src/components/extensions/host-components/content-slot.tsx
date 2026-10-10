import { type Component, createContext, onCleanup, onMount, useContext } from "solid-js";
import { type HostComponentProps } from "./types";

interface ContentSlotHandle {
  contentDOM: HTMLElement;
  parking: HTMLElement;
  /** The slot that shows the content; only one slot of a view shows it. */
  owner: HTMLElement | null;
}

const ContentSlotContext = createContext<ContentSlotHandle>();

/** Shows the element's host-owned content; extension CSS stops at `data-content-slot`. */
const ContentSlot: Component<HostComponentProps<"ContentSlot">> = () => {
  const slot = useContext(ContentSlotContext);

  let element!: HTMLDivElement;

  onMount(() => {
    if (!slot || slot.owner) return;

    slot.owner = element;
    element.append(slot.contentDOM);
  });
  onCleanup(() => {
    if (slot?.owner !== element) return;

    slot.owner = null;
    slot.parking.append(slot.contentDOM);
  });

  return <div ref={element} data-content-slot="" class="min-w-0" />;
};

export { ContentSlot, ContentSlotContext };
export type { ContentSlotHandle };
