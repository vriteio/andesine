import { type ExtensionSummary } from "@andesine/contracts/extensions";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { extensionsQuery } from "#web/lib/data";
import { createAsync, revalidate } from "@solidjs/router";
import { type Component, createEffect, onCleanup } from "solid-js";

const NOTICES = {
  approval_required: "needs approval for an update",
  configuration_required: "needs settings",
  revoked: "was disabled by its developer"
};

/** Notifies managers when an update or a revocation disables an extension. */
const ExtensionNotices: Component = () => {
  const notify = useNotify();
  const { workspaceID, hasPermission, subscribeToUpdates } = useWorkspace();
  const extensions = createAsync(async () => {
    const id = workspaceID();

    if (!id || !hasPermission("extensions")) return undefined;

    return extensionsQuery(id).catch(() => undefined);
  });
  // The last seen reason of each extension; the first load only records them.
  let reasons: Map<string, ExtensionSummary["disabledReason"]> | null = null;

  createEffect(() => {
    const current = extensions();

    if (!current) return;

    for (const extension of current) {
      const reason = extension.disabledReason;
      const isNew = reasons !== null && reasons.get(extension.id) !== reason;

      if (isNew && reason && reason !== "manual") {
        notify({ type: "info", text: `${extension.displayName} ${NOTICES[reason]}` });
      }
    }

    reasons = new Map(current.map((extension) => [extension.id, extension.disabledReason]));
  });
  onCleanup(
    subscribeToUpdates((event) => {
      const id = workspaceID();

      if (id && event.action.startsWith("extension:")) {
        void revalidate(extensionsQuery.keyFor(id));
      }
    })
  );

  return null;
};

export { ExtensionNotices };
