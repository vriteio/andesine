import { createSignal, onCleanup, onMount } from "solid-js";

interface ImageResizeOptions {
  enabled(): boolean;
  nodeID(): string;
  size(): number;
  width(): number;
  save(size: number): void;
}
interface ImageResizeStart {
  pointerID: number;
  nodeID: string;
  x: number;
  size: number;
  width: number;
  direction: number;
}

const createImageResize = (options: ImageResizeOptions) => {
  const [size, setSize] = createSignal<number | null>(null);
  const clampSize = (value: number) => Math.min(100, Math.max(20, value));
  let start: ImageResizeStart | undefined;

  const cancel = () => {
    start = undefined;
    setSize(null);
  };
  const move = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.pointerID) return;
    if (!options.enabled() || options.nodeID() !== start.nodeID) {
      cancel();
      return;
    }
    const delta = ((event.clientX - start.x) * start.direction * 200) / start.width;

    setSize(clampSize(start.size + delta));
  };
  const finish = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.pointerID) return;
    move(event);
    const finalSize = size();

    start = undefined;
    if (finalSize !== null) options.save(finalSize);
    setSize(null);
  };
  const cancelPointer = (event: PointerEvent) => {
    if (event.pointerId === start?.pointerID) cancel();
  };
  const onPointerDown = (event: PointerEvent, direction: number) => {
    const width = options.width();

    if (event.button !== 0 || start || !options.enabled() || !width) return;
    event.preventDefault();
    event.stopPropagation();
    start = {
      pointerID: event.pointerId,
      nodeID: options.nodeID(),
      x: event.clientX,
      size: options.size(),
      width,
      direction
    };
    setSize(start.size);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && start) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (!options.enabled() || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    event.stopPropagation();
    options.save(clampSize(options.size() + (event.key === "ArrowRight" ? 1 : -1)));
  };

  onMount(() => {
    // A node-view update can release pointer capture before pointerup reaches the handle.
    // Keep the resize active until release or explicit cancellation.
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", cancelPointer, true);
    window.addEventListener("blur", cancel);
    onCleanup(() => {
      cancel();
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", cancelPointer, true);
      window.removeEventListener("blur", cancel);
    });
  });

  return { size, onPointerDown, onKeyDown };
};

export { createImageResize };
