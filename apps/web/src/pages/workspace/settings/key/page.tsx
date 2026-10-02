import { useDelegationPermissions } from "#web/lib/policy/delegation";
import {
  Button,
  Fragment,
  IconButton,
  Input,
  Skeleton,
  ToggleGroup,
  Tooltip
} from "@andesine/components";
import { createAsync, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Suspense,
  For,
  Show,
  untrack
} from "solid-js";

import { useClipboard } from "#web/context/clipboard";
import { useNotify } from "#web/context/notifications";
import { type KeyKind, type KeyPermission } from "#web/lib/api";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { SecretDialog } from "../secret-dialog";
import { Dynamic } from "solid-js/web";
import { useWorkspace } from "#web/context/workspace";
import { apiKeyQuery, useKeyMutations, type Webhook } from "#web/lib/data";
import { type AccessLevel, createPermissionAccessMapper } from "#web/lib/permissions";
import { getScopeItems } from "../webhook/configuration";
import { BrowserAccessSection, originPattern } from "./browser-access-section";

type Resource =
  | "ai-answers"
  | "collections"
  | "entries"
  | "memberships"
  | "publishing"
  | "roles"
  | "versions"
  | "webhooks";
type ResourceAccess = Record<Resource, AccessLevel>;

const resources: Array<{ id: Resource; label: string; description: string }> = [
  { id: "entries", label: "Entries", description: "Content entries within collections" },
  { id: "versions", label: "Versions", description: "Entry versions and version history" },
  { id: "publishing", label: "Publishing", description: "Published content and channels" },
  { id: "collections", label: "Collections", description: "Collection structure and metadata" },
  { id: "memberships", label: "People", description: "Workspace members and invitations" },
  { id: "roles", label: "Roles", description: "Workspace roles and permissions" },
  {
    id: "webhooks",
    label: "Webhooks",
    description: "View or manage webhooks"
  },
  {
    id: "ai-answers",
    label: "AI answers",
    description: "Generate AI answers"
  }
];

const accessLevels: Array<{ value: AccessLevel; label: string }> = [
  { value: "default", label: "None" },
  { value: "read", label: "Read" },
  { value: "write", label: "Write" }
];

const { accessToPermissions, permissionsToAccess } = createPermissionAccessMapper<
  Resource,
  KeyPermission
>({
  resources: [
    { id: "entries", read: "read:entries", write: "entries" },
    { id: "versions", read: "read:versions", write: "versions" },
    { id: "publishing", read: "read:publishing", write: "publishing" },
    { id: "collections", read: "read:collections", write: "collections" },
    { id: "memberships", read: "read:memberships", write: "memberships" },
    { id: "roles", read: "read:roles", write: "roles" },
    { id: "webhooks", read: "read:webhooks", write: "webhooks" },
    { id: "ai-answers", write: "ai-answers" }
  ]
});

const KeySettingsPage: Component = () => {
  const notify = useNotify();
  const { copyText } = useClipboard();
  const { canGrantKeyPermission } = useDelegationPermissions();
  const { hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string; keyID?: string }>();
  const [searchParams, setSearchParams] = useSearchParams<{ kind?: string }>();
  const keyID = () => params.keyID || null;
  const navigateToAPI = () => navigate(`/${params.workspaceID || ""}/settings/api`);
  const keyResult = createAsync(async () => {
    if (!keyID()) return { key: null };

    try {
      return { key: await apiKeyQuery({ keyID: keyID()! }) };
    } catch (error) {
      console.error(error);

      return { key: null, error: true };
    }
  });
  const key = () => keyResult()?.key ?? null;
  const [keyName, setKeyName] = createSignal("");
  // New keys take their kind from the link; existing keys from their data.
  const [kind, setKind] = createSignal<KeyKind>(
    searchParams.kind === "publishable" ? "publishable" : "secret"
  );
  const [resourceAccess, setResourceAccess] = createSignal<ResourceAccess>(permissionsToAccess([]));
  const [collections, setCollections] = createSignal<Webhook["collections"]>({ mode: "all" });
  const [allowedOrigins, setAllowedOrigins] = createSignal<string[]>([]);
  const [answers, setAnswers] = createSignal(false);
  const [revealedKey, setRevealedKey] = createSignal<{ value: string; kind: KeyKind }>();
  const { createKeyMutation, updateKeyMutation } = useKeyMutations({
    keyID,
    navigateToAPI,
    onCreated: (value, createdKind) => setRevealedKey({ value, kind: createdKind })
  });
  const publishable = () => kind() === "publishable";
  const disabled = () => {
    return (
      !hasPermission("api_keys") ||
      (Boolean(keyID()) && !keyResult()) ||
      createKeyMutation.isPending ||
      updateKeyMutation.isPending
    );
  };
  // Publishable keys always read published content, and can answer questions about it.
  const permissions = (): KeyPermission[] => {
    if (!publishable()) return accessToPermissions(resourceAccess());

    return answers() ? ["read:publishing", "ai-answers"] : ["read:publishing"];
  };
  const permissionsChanged = createMemo(() => {
    const currentPermissions = key()?.permissions;
    const selected = permissions();

    return (
      !currentPermissions ||
      currentPermissions.length !== selected.length ||
      selected.some((permission) => !currentPermissions.includes(permission))
    );
  });
  const fillError = createMemo((): string => {
    const noCollections = collections().mode === "selected" && !getScopeItems(collections()).length;

    if (!keyName().trim()) {
      return "Key name is required";
    }

    if (publishable() && noCollections) return "Select at least one collection";

    if (publishable() && !allowedOrigins().length) return "Add an allowed origin";

    if (publishable() && allowedOrigins().some((origin) => !originPattern.test(origin))) {
      return "Use origins without a path, e.g. https://docs.example.com";
    }

    if (!permissionsChanged()) return "";

    if (permissions().some((permission) => !canGrantKeyPermission(permission)))
      return "You cannot grant permissions beyond your own role";

    if (permissions().length === 0) {
      return "Grant at least one permission";
    }

    return "";
  });
  createEffect(() => {
    const result = keyResult();
    const currentKey = key();

    if (keyID() && result?.error) {
      notify({ type: "error", text: "API key is unavailable" });
      navigate(`/${params.workspaceID || ""}/settings/api`, { replace: true });

      return;
    }

    if (currentKey) {
      setKeyName(currentKey.name);
      setKind(currentKey.kind);
      // Titles and the settings menu read the kind from the URL.
      if (untrack(() => searchParams.kind) !== currentKey.kind) {
        setSearchParams({ kind: currentKey.kind }, { replace: true });
      }

      setResourceAccess(permissionsToAccess(currentKey.permissions));
      setCollections(
        currentKey.collectionIDs.length
          ? { mode: "selected", roots: currentKey.collectionIDs }
          : { mode: "all" }
      );
      setAllowedOrigins(currentKey.allowedOrigins);
      setAnswers(currentKey.permissions.includes("ai-answers"));
    }
  });

  return (
    <>
      <SecretDialog
        kind={revealedKey()?.kind === "publishable" ? "publishable-key" : "api-key"}
        secret={revealedKey()?.value ?? ""}
        onClose={() => {
          setRevealedKey(undefined);
          createKeyMutation.reset();
          navigateToAPI();
        }}
      />
      <div class="flex min-w-0 flex-col">
        <SettingsSection label="Key details">
          <Setting label="Name" description="Descriptive name for this key" fade={false}>
            <Input
              placeholder={publishable() ? "Docs site" : "My API key"}
              variant="outlined"
              color="contrast"
              size="small"
              value={keyName()}
              setValue={setKeyName}
              disabled={!hasPermission("api_keys") || (Boolean(keyID()) && !keyResult())}
              class="w-full max-w-md"
            />
          </Setting>
          <Show when={key()?.value}>
            {(value) => (
              <Setting
                label="Key"
                description="Publishable keys are public, so you can use them in site code"
                fade={false}
              >
                <div class="flex w-full max-w-md items-center gap-1">
                  <span class="min-w-0 flex-1 truncate text-end font-mono text-sm text-gray-500">
                    {value()}
                  </span>
                  <Tooltip content="Copy key">
                    <IconButton
                      variant="text"
                      text="soft"
                      size="small"
                      icon="i-lucide:copy"
                      onClick={() => {
                        void copyText(value(), {
                          success: "Publishable key copied to clipboard",
                          fallback: { title: "Copy publishable key manually" }
                        });
                      }}
                    />
                  </Tooltip>
                </div>
              </Setting>
            )}
          </Show>
        </SettingsSection>
        <Show when={publishable()}>
          <BrowserAccessSection
            disabled={disabled()}
            collections={collections()}
            allowedOrigins={allowedOrigins()}
            answers={answers()}
            setCollections={setCollections}
            setAllowedOrigins={setAllowedOrigins}
            setAnswers={setAnswers}
          />
        </Show>
        <Show when={!publishable()}>
          <SettingsSection label="Permissions">
            <For each={resources}>
              {(resource) => (
                <Setting
                  label={resource.label}
                  description={resource.description}
                  fade={false}
                  hover
                >
                  <ToggleGroup
                    disabled={disabled()}
                    value={resourceAccess()[resource.id]}
                    setValue={(value) => {
                      setResourceAccess((prev) => ({
                        ...prev,
                        [resource.id]: value as AccessLevel
                      }));
                    }}
                    options={(resource.id === "ai-answers"
                      ? [
                          { value: "default" as const, label: "None" },
                          { value: "write" as const, label: "Allow" }
                        ]
                      : accessLevels
                    ).filter(
                      (option) =>
                        option.value === "default" ||
                        canGrantKeyPermission(
                          (option.value === "write"
                            ? resource.id
                            : `read:${resource.id}`) as KeyPermission
                        )
                    )}
                  />
                </Setting>
              )}
            </For>
          </SettingsSection>
        </Show>
        <div class="w-full h-4 flex justify-center items-center">
          <div class="flex-1 h-px bg-gray-200" />
        </div>
        <Suspense fallback={<Skeleton class="h-9 w-full rounded-lg" />}>
          <div class="flex items-center justify-end gap-2">
            <Tooltip content="Go back">
              <IconButton
                variant="outlined"
                color="contrast"
                text="soft"
                size="small"
                icon="i-lucide:chevron-left"
                onClick={navigateToAPI}
              />
            </Tooltip>
            <Dynamic
              component={fillError() ? Tooltip : Fragment}
              content={fillError()}
              wrapperClass="flex-1"
            >
              <Button
                color="primary"
                variant="outlined"
                size="small"
                onClick={() => {
                  const scope = publishable()
                    ? {
                        collectionIDs: getScopeItems(collections()),
                        allowedOrigins: allowedOrigins()
                      }
                    : {};

                  if (keyID()) {
                    updateKeyMutation.mutate({
                      id: keyID()!,
                      name: keyName(),
                      ...(permissionsChanged() && { permissions: permissions() }),
                      ...scope
                    });
                  } else {
                    createKeyMutation.mutate({
                      name: keyName(),
                      kind: kind(),
                      permissions: permissions(),
                      ...scope
                    });
                  }
                }}
                class="flex items-center gap-1 w-full justify-center"
                disabled={!hasPermission("api_keys") || Boolean(fillError())}
                loading={createKeyMutation.isPending || updateKeyMutation.isPending}
              >
                {Boolean(keyID()) ? "Save changes" : "Create key"}
              </Button>
            </Dynamic>
          </div>
        </Suspense>
      </div>
    </>
  );
};

export default KeySettingsPage;
