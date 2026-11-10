import { Button, Dialog, IconButton, Input } from "@andesine/components";
import { type Component, createEffect, createSignal } from "solid-js";

interface ConfirmDeletionContentProps {
  opened: boolean;
  label: string;
  description: string;
  confirmation: string;
  pending: boolean;
  ready?: boolean;
  onConfirm(): void;
  onClose(): void;
}

const ConfirmDeletionContent: Component<ConfirmDeletionContentProps> = (props) => {
  const [value, setValue] = createSignal("");
  const canConfirm = () => {
    return Boolean(
      props.confirmation &&
      value() === props.confirmation &&
      props.ready !== false &&
      !props.pending
    );
  };

  createEffect(() => {
    if (!props.opened) setValue("");
  });

  return (
    <>
      <div class="flex flex-col gap-0.5">
        <h3 class="text-lg font-semibold leading-tight">{props.label} permanently?</h3>
        <p class="text-sm leading-tight text-gray-400">{props.description}</p>
      </div>
      <label class="flex flex-col gap-1 text-xs">
        <span>
          Type{" "}
          <span class="relative">
            <div class="absolute rounded-md top-0 left-0 h-full w-full bg-gray-950/2.5" />
            <span class="font-mono relative font-medium py-0.5 px-1 whitespace-pre-wrap leading-normal">
              {props.confirmation}
            </span>
          </span>{" "}
          to confirm
        </span>
        <Input
          value={value()}
          setValue={setValue}
          disabled={props.pending}
          placeholder={props.confirmation}
          class="font-mono"
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !canConfirm()) return;

            event.preventDefault();
            props.onConfirm();
          }}
        />
      </label>
      <div class="flex justify-end gap-2">
        <IconButton icon="i-lucide:x" disabled={props.pending} onClick={props.onClose}>
          Cancel
        </IconButton>
        <Button
          variant="danger"
          loading={props.pending}
          disabled={!canConfirm()}
          onClick={props.onConfirm}
          class="flex-1"
        >
          Delete permanently
        </Button>
      </div>
    </>
  );
};
const ConfirmDeletionDialog: Component<ConfirmDeletionContentProps> = (props) => {
  const close = () => {
    if (!props.pending) props.onClose();
  };

  return (
    <Dialog opened={props.opened} onOverlayClick={close} aria-label={props.label}>
      <ConfirmDeletionContent {...props} />
    </Dialog>
  );
};

export { ConfirmDeletionContent, ConfirmDeletionDialog };
