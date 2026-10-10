import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import { useClipboard } from "#web/context/clipboard";
import { useNotify } from "#web/context/notifications";
import { setExtensionHostActions, type ExtensionHostActions } from "#web/lib/extensions";
import { type Component, createSignal, onCleanup, Show } from "solid-js";

interface PendingURL {
  url: string;
  extension: string;
  resolve(): void;
}

const openInNewTab = (url: string): void => {
  window.open(url, "_blank", "noopener,noreferrer");
};
/** Performs extension host actions; undeclared URLs need a confirmation that names the domain. */
const ExtensionHostActions: Component = () => {
  const { copyText } = useClipboard();
  const notify = useNotify();
  const [pendingURL, setPendingURL] = createSignal<PendingURL | null>(null);
  const closeURL = () => {
    pendingURL()?.resolve();
    setPendingURL(null);
  };
  const actions: ExtensionHostActions = {
    async copyText(text, extension) {
      await copyText(text, {
        fallback: { title: "Copy text", description: `${extension} provided this text.` }
      });
    },
    async downloadFile(file) {
      const url = URL.createObjectURL(new Blob([file.text], { type: file.type }));
      const link = document.createElement("a");

      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    openURL(url, declared, extension) {
      if (declared) {
        openInNewTab(url);

        return Promise.resolve();
      }

      pendingURL()?.resolve();

      return new Promise((resolve) => setPendingURL({ url, extension, resolve }));
    },
    // Named, so an extension cannot pass its messages off as Andesine's.
    notify({ text, type = "success" }, extension) {
      notify({ type, text: `${extension}: ${text}` });
    }
  };

  onCleanup(setExtensionHostActions(actions));

  return (
    <Show when={pendingURL()}>
      {(pending) => (
        <ActionConfirmationDialog
          opened
          title="Open external link?"
          description={
            <>
              {pending().extension} wants to open a page on{" "}
              <span class="font-medium">{new URL(pending().url).hostname}</span>, outside its
              declared URLs.
            </>
          }
          affected={[
            {
              id: pending().url,
              icon: "i-lucide:external-link",
              label: new URL(pending().url).hostname,
              detail: pending().url
            }
          ]}
          action={{
            color: "primary",
            label: "Open",
            onClick: () => {
              openInNewTab(pending().url);
              closeURL();
            }
          }}
          onClose={closeURL}
        />
      )}
    </Show>
  );
};

export { ExtensionHostActions };
