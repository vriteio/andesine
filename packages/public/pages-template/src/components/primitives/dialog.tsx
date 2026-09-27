import { Dialog as ArkDialog } from "@ark-ui/solid/dialog";
import clsx from "clsx";
import type { ParentComponent } from "solid-js";
import { Portal } from "solid-js/web";
import { Card } from "./card";

interface DialogProps {
  open: boolean;
  /** The dialog's accessible name. */
  label: string;
  /** Element that gets focus on open; the default is the first focusable element. */
  initialFocus?(): HTMLElement | null | undefined;
  class?: string;
  onOpenChange(open: boolean): void;
}

/** A dialog near the top of the screen, over the blurred page, e.g. for search. */
const Dialog: ParentComponent<DialogProps> = (props) => (
  <ArkDialog.Root
    open={props.open}
    initialFocusEl={props.initialFocus && (() => props.initialFocus?.() ?? null)}
    onOpenChange={(details) => props.onOpenChange(details.open)}
  >
    <Portal>
      <ArkDialog.Backdrop class="fixed inset-0 z-70 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <ArkDialog.Positioner class="fixed inset-0 z-70 flex items-start justify-center px-4 pb-4 pt-[10dvh]">
        <ArkDialog.Content
          aria-label={props.label}
          class="outline-none data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out"
        >
          <Card
            shade
            class={clsx(
              ":base-2: flex w-xl max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl p-3 md:p-4",
              props.class
            )}
          >
            {props.children}
          </Card>
        </ArkDialog.Content>
      </ArkDialog.Positioner>
    </Portal>
  </ArkDialog.Root>
);

export { Dialog };
export type { DialogProps };
