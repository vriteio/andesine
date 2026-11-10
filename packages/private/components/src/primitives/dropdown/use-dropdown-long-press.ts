import { type JSX, onCleanup } from "solid-js";
import { createRef } from "../../ref";

interface DropdownLongPressOptions {
  delay?: number;
  enabled(event: PointerEvent): boolean;
  onLongPress(event: PointerEvent): void;
  tolerance?: number;
}

const DOUBLE_TAP_DELAY = 350;
const DOUBLE_TAP_DISTANCE = 30;
const handledLongPressEvents = new WeakSet<Event>();

const useDropdownLongPress = (options: DropdownLongPressOptions) => {
  const delay = () => options.delay ?? 500;
  const tolerance = () => options.tolerance ?? 10;
  const [start, setStart] = createRef<{ x: number; y: number } | null>(null);
  const [timeout, setTimeoutRef] = createRef(0);
  const [triggered, setTriggered] = createRef(false);
  const [restoreSelection, setRestoreSelection] = createRef<(() => void) | null>(null);
  const [listening, setListening] = createRef(false);
  const [lastTap, setLastTap] = createRef<{ x: number; y: number; time: number } | null>(null);
  const handlePointerMove = (event: PointerEvent) => {
    const initialPoint = start();
    const moved =
      initialPoint &&
      Math.hypot(event.clientX - initialPoint.x, event.clientY - initialPoint.y) > tolerance();

    if (moved) cancelGesture();
  };
  // The end of the touch may not reach the area, e.g. when the touched element re-renders on tap.
  const listenToGesture = () => {
    setListening(true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", endGesture, true);
    window.addEventListener("touchend", endGesture, true);
    window.addEventListener("pointercancel", cancelGesture, true);
    window.addEventListener("touchcancel", cancelGesture, true);
  };
  // Also runs on cleanup during server rendering, where nothing listens and `window` is missing.
  const stopListeningToGesture = () => {
    if (!listening()) return;

    setListening(false);
    window.removeEventListener("pointermove", handlePointerMove, true);
    window.removeEventListener("pointerup", endGesture, true);
    window.removeEventListener("touchend", endGesture, true);
    window.removeEventListener("pointercancel", cancelGesture, true);
    window.removeEventListener("touchcancel", cancelGesture, true);
  };
  const releaseGesture = () => {
    if (timeout()) clearTimeout(timeout()!);

    stopListeningToGesture();
    setTimeoutRef(0);
    setStart(null);
    restoreSelection()?.();
    setRestoreSelection(null);
  };
  const cancelGesture = () => {
    releaseGesture();
    setTriggered(false);
  };
  // A touch that ends before the long press is a tap; a second one soon after is a double tap.
  const endGesture = () => {
    const point = start();

    if (point && timeout()) setLastTap({ ...point, time: Date.now() });

    releaseGesture();
  };
  const isDoubleTap = (event: PointerEvent) => {
    const tap = lastTap();

    return (
      tap !== null &&
      Date.now() - tap.time < DOUBLE_TAP_DELAY &&
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < DOUBLE_TAP_DISTANCE
    );
  };
  const onPointerDown: JSX.EventHandler<HTMLDivElement, PointerEvent> = (event) => {
    if (event.pointerType === "mouse" || !options.enabled(event)) return;
    if (handledLongPressEvents.has(event)) return;
    handledLongPressEvents.add(event);

    cancelGesture();

    // A double tap selects a word on touch, and iOS doesn't always end its second touch.
    if (isDoubleTap(event)) {
      setLastTap(null);
      return;
    }

    listenToGesture();
    setStart({ x: event.clientX, y: event.clientY });
    setTimeoutRef(
      window.setTimeout(() => {
        setTimeoutRef(0);
        setTriggered(true);
        options.onLongPress(event);
      }, delay())
    );
  };
  const onClick: JSX.EventHandler<HTMLDivElement, MouseEvent> = (event) => {
    if (!triggered()) return;

    setTriggered(false);
    event.preventDefault();
    event.stopPropagation();
  };

  onCleanup(cancelGesture);

  return {
    onPointerDown,
    onDragStart: cancelGesture,
    onClick
  };
};

export { useDropdownLongPress };
