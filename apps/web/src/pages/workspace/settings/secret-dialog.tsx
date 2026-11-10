import { useClipboard } from "#web/context/clipboard";
import { Button, Card, Dialog, IconButton } from "@andesine/components";
import { type Component, createEffect, createSignal } from "solid-js";

interface SecretDialogProps {
  kind: SecretKind;
  // The plaintext value. The dialog is open while it is non-empty.
  secret: string;
  onClose(): void;
}
interface SecretKindText {
  copyLabel: string;
  description: string;
  name: string;
  title: string;
}

type SecretKind = "api-key" | "publishable-key" | "webhook-secret";

const secretKindText: Record<SecretKind, SecretKindText> = {
  "api-key": {
    title: "Your API key",
    description: "Copy this key now. You won't be able to see it again",
    copyLabel: "Copy key",
    name: "API key"
  },
  "publishable-key": {
    title: "Your publishable key",
    description:
      "Add this key to your site. It is safe in browsers, and you can copy it again from the key settings",
    copyLabel: "Copy key",
    name: "Publishable key"
  },
  "webhook-secret": {
    title: "Your signing secret",
    description:
      "Copy this secret now and store it in the receiver. You won't be able to see it again",
    copyLabel: "Copy secret",
    name: "Signing secret"
  }
};

const SecretDialog: Component<SecretDialogProps> = (props) => {
  const { copyText } = useClipboard();
  const [visibleSecret, setVisibleSecret] = createSignal(props.secret);
  const [copied, setCopied] = createSignal(false);
  const text = () => secretKindText[props.kind];
  const handleClose = () => {
    props.onClose();
    setTimeout(() => setVisibleSecret(""), 300);
  };
  const copySecret = async () => {
    const secret = visibleSecret();

    if (!secret || copied()) return;

    const success = await copyText(secret, {
      success: `${text().name} copied to clipboard`,
      fallback: { title: `Copy ${text().name.toLowerCase()} manually` }
    });

    if (!success) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  createEffect(() => {
    if (props.secret) {
      setVisibleSecret(props.secret);
    }
  });

  return (
    <Dialog opened={Boolean(props.secret)} onOverlayClick={handleClose} size="large">
      <div class="flex flex-col gap-0.5">
        <h3 class="text-lg font-semibold leading-tight">{text().title}</h3>
        <p class="text-sm text-gray-400 leading-tight">{text().description}</p>
      </div>
      <Card
        class="flex justify-center items-center select-all min-h-16 break-all rounded-xl p-3 font-mono text-sm border-0"
        color="contrast"
      >
        {visibleSecret()}
      </Card>
      <div class="flex gap-2">
        <IconButton icon="i-lucide:x" onClick={handleClose} />
        <Button onClick={copySecret} disabled={copied()} class="flex-1">
          {copied() ? "Copied!" : text().copyLabel}
        </Button>
      </div>
    </Dialog>
  );
};

export { SecretDialog };
export type { SecretKind };
