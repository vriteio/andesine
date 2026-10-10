import {
  type ExtensionConfiguration,
  type ExtensionConfigurationState
} from "@andesine/contracts/extensions";
import { createAsync, revalidate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { createComputed, createMemo, createSignal, untrack } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useNotify } from "#web/context/notifications";
import { client } from "#web/lib/api";
import { extensionConfigurationQuery, extensionQuery, getWebhookErrorCode } from "#web/lib/data";
import {
  type ConfigurationDraft,
  createConfigurationDraft,
  getConfigurationErrors,
  toConfigurationSubmission
} from "../extension/configuration-form";

interface ConfigurationFormOptions {
  extensionID: string;
  workspaceID: string;
  schema: ExtensionConfiguration | null;
  canManage: boolean;
}

/** Saves send the loaded revision; another manager's save marks the form stale instead. */
const useConfigurationForm = (options: ConfigurationFormOptions) => {
  const notify = useNotify();
  const [draft, setDraft] = createStore<ConfigurationDraft>({ values: {}, secrets: {} });
  const [baseline, setBaseline] = createSignal<ExtensionConfigurationState | null>(null);
  const [stale, setStale] = createSignal(false);
  const reloadState = { requested: false };
  const input = () => ({ extensionID: options.extensionID, workspaceID: options.workspaceID });
  // Extensions without fields have no configuration to load.
  const state = createAsync(() => {
    if (!Object.keys(options.schema?.properties ?? {}).length) return Promise.resolve(null);

    return extensionConfigurationQuery(input());
  });
  const errors = createMemo(() => {
    return getConfigurationErrors(options.schema, draft, Object.keys(baseline()?.secrets ?? {}));
  });
  // Serializing reads every draft field, so the memo tracks nested store changes.
  const hasChanges = createMemo(() => {
    const current = baseline();

    if (!current) return false;

    const saved = toConfigurationSubmission(
      options.schema,
      createConfigurationDraft(options.schema, current.values)
    );

    return (
      JSON.stringify(toConfigurationSubmission(options.schema, draft)) !== JSON.stringify(saved)
    );
  });
  const reload = () => {
    reloadState.requested = true;
    void revalidate(extensionConfigurationQuery.keyFor(input()));
  };
  const saveMutation = createMutation(() => ({
    retry: false,
    mutationFn: (expectedRevision: number) => {
      return client.extensions.setConfiguration({
        extensionID: options.extensionID,
        ...structuredClone(toConfigurationSubmission(options.schema, draft)),
        expectedRevision
      });
    },
    onSuccess: () => {
      notify({ type: "success", text: "Settings saved" });
      reload();
      void revalidate(extensionQuery.keyFor(input()));
    },
    onError: (error) => {
      const code = getWebhookErrorCode(error);

      console.error(error);

      if (code === "CONFLICT" || code === "NOT_FOUND") {
        setStale(true);
        notify({ type: "error", text: "Settings changed. Reload them to continue" });

        return;
      }

      notify({ type: "error", text: "Failed to save the settings. Check the fields" });
    }
  }));
  const disabled = () => !options.canManage || stale() || saveMutation.isPending || !baseline();
  const fillError = () => {
    if (stale()) return "Reload the settings before saving";
    if (Object.keys(errors()).length) return "Fix the marked fields";

    return hasChanges() ? "" : "No changes to save";
  };

  createComputed(() => {
    const current = state();
    const previous = untrack(baseline);

    if (!current) return;

    const isExternalSave =
      !reloadState.requested && previous && current.revision !== previous.revision;

    if (isExternalSave) {
      // Never overwrite unsaved edits.
      if (untrack(hasChanges)) {
        setStale(true);

        return;
      }
    }

    reloadState.requested = false;
    setStale(false);
    setBaseline(current);
    setDraft(reconcile(createConfigurationDraft(options.schema, current.values)));
  });

  return {
    draft,
    setDraft,
    secrets: () => baseline()?.secrets ?? {},
    errors,
    stale,
    disabled,
    fillError,
    saving: () => saveMutation.isPending,
    save: () => saveMutation.mutate(baseline()!.revision),
    reload
  };
};

type ConfigurationForm = ReturnType<typeof useConfigurationForm>;

export { useConfigurationForm };
export type { ConfigurationForm };
