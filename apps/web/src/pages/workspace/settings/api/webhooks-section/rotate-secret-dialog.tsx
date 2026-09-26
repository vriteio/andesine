import { Button, Card, Dialog, IconButton, ToggleGroup } from "@andesine/components";
import { type Component, createEffect, createSignal, type JSX } from "solid-js";
import { getWebhookHost } from "../../webhook/configuration";

type RotationMode = "overlap" | "immediate";

interface RotateSecretDialogProps {
  webhook: { name: string; url: string } | null;
  loading?: boolean;
  onClose(): void;
  onConfirm(mode: RotationMode): void;
}

const rotationOptions: Array<{ value: RotationMode; label: string; description: JSX.Element }> = [
  {
    value: "overlap",
    label: "24 hours",
    description: (
      <span>
        The current secret keeps working for <span class="font-medium text-gray-700">24 hours</span>
        , so the receiver can switch without rejecting events.
      </span>
    )
  },
  {
    value: "immediate",
    label: "Now",
    description: (
      <span>
        The current secret and any earlier overlapping secret stop working{" "}
        <span class="font-medium text-gray-700">immediately</span>. Use this when a secret was
        exposed.
      </span>
    )
  }
];

const RotateSecretDialog: Component<RotateSecretDialogProps> = (props) => {
  const [mode, setMode] = createSignal<RotationMode>("overlap");
  const [visibleWebhook, setVisibleWebhook] = createSignal(props.webhook);
  const handleClose = () => {
    if (props.loading) return;

    props.onClose();
    setTimeout(() => {
      setVisibleWebhook(null);
      setMode("overlap");
    }, 300);
  };

  createEffect(() => {
    if (props.webhook) {
      setVisibleWebhook(props.webhook);
      setMode("overlap");
    }
  });

  return (
    <Dialog
      opened={Boolean(props.webhook)}
      onOverlayClick={handleClose}
      size="large"
      aria-label="Rotate signing secret"
    >
      <div class="flex flex-col gap-0.5">
        <h3 class="text-lg font-semibold leading-tight">Rotate signing secret?</h3>
        <p class="text-sm leading-tight text-gray-400">
          A new secret is created and shown only once. New event deliveries are signed with it.
        </p>
      </div>
      <Card class="flex h-8 items-center gap-1 rounded-lg border-0 px-1 py-0.5" color="contrast">
        <div class="flex h-6 w-6 items-center justify-center">
          <div class="i-lucide:webhook h-5 w-5 text-gray-400" />
        </div>
        <div class="flex flex-1 items-center gap-1.5">
          <span class="line-clamp-1 font-medium">{visibleWebhook()?.name}</span>
          <div class="h-4 w-px shrink-0 rounded-full bg-gray-200" />
          <span class="shrink-0 font-mono text-xs text-gray-400">
            {getWebhookHost(visibleWebhook()?.url || "")}
          </span>
        </div>
      </Card>
      <p class="text-sm leading-tight text-gray-400">
        {rotationOptions.find(({ value }) => value === mode())?.description}
      </p>
      <ToggleGroup
        value={mode()}
        setValue={(value) => {
          if (value) setMode(value as RotationMode);
        }}
        options={rotationOptions.map(({ value, label }) => ({ value, label }))}
        disabled={props.loading}
        wrapperClass="w-full"
        itemClass="flex-1"
      />
      <div class="flex gap-2">
        <IconButton
          variant="outlined"
          color="contrast"
          text="soft"
          size="small"
          icon="i-lucide:x"
          disabled={props.loading}
          onClick={handleClose}
        />
        <Button
          color="primary"
          variant="outlined"
          size="small"
          loading={props.loading}
          onClick={() => props.onConfirm(mode())}
          class="flex-1"
        >
          Rotate secret
        </Button>
      </div>
    </Dialog>
  );
};

export { RotateSecretDialog };
export type { RotationMode };
