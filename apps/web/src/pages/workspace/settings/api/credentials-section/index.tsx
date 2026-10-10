import { Card, IconButton } from "@andesine/components";
import { Tree, TREE_ROOT_ID, type TreeMap, TreeSkeleton } from "#web/components/tree";
import { useNotify } from "#web/context/notifications";
import { client, type Key, type KeyKind, type KeyPermission } from "#web/lib/api";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import clsx from "clsx";
import {
  batch,
  For,
  type Component,
  createMemo,
  createSignal,
  Show,
  Suspense,
  useTransition
} from "solid-js";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { APIKeyItem } from "./api-key-item";
import { DeleteKeyDialog } from "./delete-key-dialog";
import { RotateKeyDialog, type ExpirationOption } from "./rotate-key-dialog";
import { SecretDialog } from "../../secret-dialog";
import { useWorkspace } from "#web/context/workspace";
import { apiKeysQuery } from "#web/lib/data";

interface KeyGroup {
  kind: KeyKind;
  label: string;
  description: string;
  empty: string;
}

interface APIKeyListProps {
  kind: KeyKind;
  canManage: boolean;
  keys: Key[];
  keysRefreshing?: boolean;
  refreshKeys(onRevalidate?: () => void): void;
}

const keyGroups: KeyGroup[] = [
  {
    kind: "secret",
    label: "Secret keys",
    description: "Authenticate requests from servers, apps, or scripts. Keep them private",
    empty: "No secret keys"
  },
  {
    kind: "publishable",
    label: "Publishable keys",
    description: "Read and search published content from browsers, e.g. on a docs site",
    empty: "No publishable keys"
  }
];

const APIKeyList: Component<APIKeyListProps> = (props) => {
  const notify = useNotify();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  const settingsPath = () => `/${params.workspaceID || ""}/settings`;
  const [revealedKey, setRevealedKey] = createSignal<string>("");
  const [rotationTarget, setRotationTarget] = createSignal<Key | null>(null);
  const [deletionTargets, setDeletionTargets] = createSignal<Key[]>([]);
  const notifyKeyDeletion = (successful: number, failed: number) => {
    if (successful > 0) {
      notify({
        type: "success",
        text: successful > 1 ? `${successful} API keys deleted` : "API key deleted"
      });
    }

    if (failed > 0) {
      notify({
        type: "error",
        text: failed > 1 ? `${failed} API keys failed to delete` : "Failed to delete API key"
      });
    }
  };
  const rotateKeyMutation = createMutation(() => ({
    onSuccess: (data) => {
      setRotationTarget(null);
      props.refreshKeys(() => {
        batch(() => {
          setRevealedKey(data.rawKey);
          rotateKeyMutation.reset();
        });
      });
      notify({ type: "success", text: "API key rotated" });
    },
    onError: (error) => {
      console.error(error);
      props.refreshKeys();
      notify({ type: "error", text: "Failed to rotate API key" });
    },
    mutationFn: (input: { id: string; expiresIn: ExpirationOption }) => client.keys.rotate(input)
  }));
  const deleteKeyMutation = createMutation(() => ({
    onSuccess: (_, { ids }) => {
      setDeletionTargets([]);
      props.refreshKeys(() => {
        deleteKeyMutation.reset();
        notifyKeyDeletion(ids.length, 0);
      });
    },
    onError: (error, { ids }) => {
      console.error(error);
      props.refreshKeys(() => {
        const failed = ids.filter((id) => props.keys.some((key) => key.id === id)).length;

        setDeletionTargets([]);
        deleteKeyMutation.reset();
        notifyKeyDeletion(ids.length - failed, failed);
      });
    },
    mutationFn: (input: { ids: string[] }) => client.keys.delete(input)
  }));
  // Spinners belong only to keys with an action in progress, never to list refreshes.
  const isKeyPending = (id: string) => {
    const rotating = rotateKeyMutation.isPending && rotateKeyMutation.variables?.id === id;
    const deleting =
      deleteKeyMutation.isPending && Boolean(deleteKeyMutation.variables?.ids.includes(id));

    return rotating || deleting;
  };
  const visibleKeys = createMemo(() => {
    // Sort keys by creation date first, moving expired ones to the end of the list
    const orderedKeys = props.keys
      .filter((key) => key.kind === props.kind)
      .sort((a, b) => {
        if (a.expiresAt && !b.expiresAt) return 1;
        if (!a.expiresAt && b.expiresAt) return -1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    if ((deleteKeyMutation.isPending || props.keysRefreshing) && deleteKeyMutation.variables) {
      return orderedKeys.filter((key) => !deleteKeyMutation.variables!.ids.includes(key.id));
    }

    return orderedKeys;
  });
  const keysTree = createMemo<TreeMap>(() => ({
    [TREE_ROOT_ID]: {
      items: visibleKeys().map((key) => key.id),
      levels: []
    }
  }));

  return (
    <>
      <SecretDialog
        kind={props.kind === "publishable" ? "publishable-key" : "api-key"}
        secret={revealedKey()}
        onClose={() => setRevealedKey("")}
      />
      <RotateKeyDialog
        key={rotationTarget()}
        loading={rotateKeyMutation.isPending}
        onClose={() => {
          setRotationTarget(null);
          rotateKeyMutation.reset();
        }}
        onConfirm={(expiresIn) => {
          const key = rotationTarget();

          if (key) {
            rotateKeyMutation.mutate({ id: key.id, expiresIn });
          }
        }}
      />
      <DeleteKeyDialog
        keys={deletionTargets()}
        loading={deleteKeyMutation.isPending}
        onClose={() => {
          setDeletionTargets([]);
          deleteKeyMutation.reset();
        }}
        onConfirm={(ids) => deleteKeyMutation.mutate({ ids })}
      />
      <Show
        when={visibleKeys().length}
        fallback={
          <Card
            class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
            shade
          >
            <div
              class={clsx(
                "h-5.5 w-5.5 text-gray-300",
                props.kind === "publishable" ? "i-tabler:circle-key" : "i-lucide:key-round"
              )}
            />
            {keyGroups.find((group) => group.kind === props.kind)?.empty}
          </Card>
        }
      >
        <Tree
          keyboard
          tree={keysTree}
          itemHeight="2rem"
          renderItem={(itemID) => {
            const key = () => visibleKeys().find((currentKey) => currentKey.id === itemID)!;

            return (
              <APIKeyItem
                id={key().id}
                name={key().name}
                prefix={key().prefix}
                kind={key().kind}
                value={key().value}
                permissions={key().permissions as KeyPermission[]}
                createdAt={key().createdAt}
                expiresAt={key().expiresAt}
                canManage={props.canManage}
                loading={isKeyPending(key().id)}
                onEdit={() => {
                  navigate(
                    `${settingsPath()}/key/${encodeURIComponent(key().id)}?kind=${key().kind}`
                  );
                }}
                onRotate={() => setRotationTarget(key())}
                onDelete={(ids) => {
                  setDeletionTargets(
                    ids.flatMap((id) => {
                      const target = props.keys.find((candidate) => candidate.id === id);

                      return target ? [target] : [];
                    })
                  );
                }}
              />
            );
          }}
        />
      </Show>
    </>
  );
};

const CredentialsSection: Component = () => {
  const { hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  const keys = createAsync(() => apiKeysQuery(), { initialValue: [] });
  const [keysRefreshing, startKeysRefresh] = useTransition();
  const refreshKeys = (onRevalidate = () => {}) => {
    void startKeysRefresh(() => {
      void (async () => {
        await revalidate(apiKeysQuery.key);
        onRevalidate();
      })();
    });
  };

  return (
    <SettingsSection label="Credentials">
      <For each={keyGroups}>
        {(group) => (
          <div class="flex flex-col">
            <Setting label={group.label} description={group.description}>
              <Show when={hasPermission("api_keys")}>
                <IconButton
                  label={() => <span class="px-1">Create {group.kind} key</span>}
                  class="flex-row-reverse pr-1"
                  onClick={() => {
                    navigate(`/${params.workspaceID || ""}/settings/key?kind=${group.kind}`);
                  }}
                  iconProps={{ class: "h-4 w-4" }}
                  icon="i-lucide:plus"
                />
              </Show>
            </Setting>
            <div class="relative flex w-full flex-col">
              <Suspense
                fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={2} size="medium" />}
              >
                <APIKeyList
                  kind={group.kind}
                  keys={keys()}
                  canManage={hasPermission("api_keys")}
                  keysRefreshing={keysRefreshing()}
                  refreshKeys={refreshKeys}
                />
              </Suspense>
            </div>
          </div>
        )}
      </For>
    </SettingsSection>
  );
};

export { CredentialsSection };
