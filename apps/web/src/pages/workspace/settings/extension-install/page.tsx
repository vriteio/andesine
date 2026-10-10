import { type ExtensionCatalogDetails } from "@andesine/contracts/extensions";
import { Button, IconButton, Tooltip } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createEffect, createMemo, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { ExtensionIcon } from "#web/components/extensions/extension-icon";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { extensionCatalogItemQuery, extensionsQuery } from "#web/lib/data";
import { useDelegationPermissions } from "#web/lib/policy/delegation";
import { ConfigurationFields } from "../extension/configuration-fields";
import {
  type ConfigurationDraft,
  createConfigurationDraft,
  getConfigurationErrors,
  toConfigurationSubmission
} from "../extension/configuration-form";
import { AccessSummary } from "../extension/access-summary";
import { canGrantExtensionPermission } from "../extension/permissions";
import { getExtensionPath } from "../extensions/state";
import { SettingsSection } from "../settings-section";
import { LoadError } from "../webhook/load-notices";

interface InstallReviewProps {
  item: ExtensionCatalogDetails;
  workspaceID: string;
}
interface CatalogLoadResult {
  error?: true;
  item: ExtensionCatalogDetails | null;
}

// What members see in the app, in plain words.
const describeContributions = (item: ExtensionCatalogDetails): string => {
  const parts = [
    ...item.panels.map(({ name }) => `the ${name} panel`),
    ...item.blockActions.map(({ label }) => `“${label}” in the block menu`),
    ...item.elementViews.map(({ element }) => `a view for ${element} content`)
  ];

  return parts.length ? `Adds ${parts.join(", ")}` : "Works in the background";
};
/** Missing required fields install the extension disabled until they are filled in. */
const InstallReview: Component<InstallReviewProps> = (props) => {
  const notify = useNotify();
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const canGrant = canGrantExtensionPermission(useDelegationPermissions());
  const [draft, setDraft] = createStore<ConfigurationDraft>(
    createConfigurationDraft(props.item.configuration, {})
  );
  const errors = createMemo(() => getConfigurationErrors(props.item.configuration, draft, []));
  const blocked = () => props.item.grant.permissions.filter((item) => !canGrant(item));
  const fillError = () => {
    const invalid = Object.values(errors()).some((error) => error !== "Required");

    if (!hasPermission("extensions")) return "You can't install extensions";
    if (blocked().length) return "You can't give every permission it asks for";

    return invalid ? "Fix the marked fields" : "";
  };
  const installMutation = createMutation(() => ({
    retry: false,
    mutationFn: () => {
      const submission = toConfigurationSubmission(props.item.configuration, draft);
      const secrets = Object.fromEntries(
        Object.entries(submission.secrets).filter((entry): entry is [string, string] => {
          return typeof entry[1] === "string";
        })
      );

      return client.extensions.install({
        name: props.item.name,
        values: submission.values,
        secrets
      });
    },
    onSuccess: (state) => {
      notify({
        type: "success",
        text:
          state.state === "active"
            ? "Extension installed"
            : "Installed; finish its configuration to enable it"
      });
      void revalidate(extensionsQuery.keyFor(props.workspaceID));
      navigate(getExtensionPath(props.workspaceID, state.id), { replace: true });
    },
    onError: (error) => {
      console.error(error);
      notify({
        type: "error",
        text: error instanceof Error && error.message ? error.message : "Failed to install"
      });
    }
  }));

  return (
    <div class="flex min-w-0 flex-col">
      <div class="flex items-start gap-3 pb-4">
        <ExtensionIcon
          name={props.item.name}
          icon={props.item.icon}
          iconStyles={props.item.iconStyles}
          class="mt-0.5 h-8 w-8 shrink-0"
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <h2 class="truncate text-lg font-semibold">{props.item.displayName}</h2>
          <p class="text-sm text-gray-500">{props.item.description}</p>
          <p class="pt-1 text-sm text-gray-600">{describeContributions(props.item)}.</p>
        </div>
      </div>
      <SettingsSection label="What it can do">
        <AccessSummary grant={props.item.grant} canGrant={canGrant} />
      </SettingsSection>
      <Show when={Object.keys(props.item.configuration?.properties ?? {}).length}>
        <SettingsSection label="Settings">
          <ConfigurationFields
            schema={props.item.configuration}
            draft={draft}
            setDraft={setDraft}
            secrets={{}}
            errors={errors()}
            disabled={!hasPermission("extensions") || installMutation.isPending}
          />
        </SettingsSection>
      </Show>
      <div class="flex h-4 w-full items-center justify-center">
        <div class="h-px flex-1 bg-gray-200" />
      </div>
      <div class="flex items-center justify-end gap-2">
        <Tooltip content="Go back">
          <IconButton
            icon="i-lucide:chevron-left"
            disabled={installMutation.isPending}
            onClick={() => navigate(`/${props.workspaceID}/settings/extensions`)}
          />
        </Tooltip>
        <Tooltip content={fillError()} enabled={Boolean(fillError())} wrapperClass="flex-1">
          <Button
            class="w-full"
            disabled={Boolean(fillError())}
            loading={installMutation.isPending}
            onClick={() => installMutation.mutate()}
          >
            Install extension
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};
const ExtensionInstallPage: Component = () => {
  const params = useParams<{ workspaceID?: string; scope?: string; name?: string }>();
  const navigate = useNavigate();
  const workspaceID = () => params.workspaceID || "";
  const name = () => `${params.scope || ""}/${params.name || ""}`;
  const result = createAsync<CatalogLoadResult>(async () => {
    try {
      return {
        item: await extensionCatalogItemQuery({ name: name(), workspaceID: workspaceID() })
      };
    } catch (error) {
      console.error(error);

      return { item: null, error: true };
    }
  });
  const reload = () => {
    void revalidate(extensionCatalogItemQuery.keyFor({ name: name(), workspaceID: workspaceID() }));
  };

  // An installed extension opens its settings instead.
  createEffect(() => {
    const installed = result()?.item?.installed;

    if (installed) navigate(getExtensionPath(workspaceID(), installed.id), { replace: true });
  });

  return (
    <Show
      when={!result()?.error}
      fallback={
        <LoadError
          label="This extension could not be loaded"
          onRetry={reload}
          onBack={() => navigate(`/${workspaceID()}/settings/extensions`)}
        />
      }
    >
      <Show when={result()?.item?.installed === null && result()?.item} keyed>
        {(item) => <InstallReview item={item} workspaceID={workspaceID()} />}
      </Show>
    </Show>
  );
};

export default ExtensionInstallPage;
