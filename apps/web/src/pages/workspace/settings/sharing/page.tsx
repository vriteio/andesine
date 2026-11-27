import { Button, Card, Input, Select, ToggleGroup } from "@andesine/components";
import { debounce } from "@solid-primitives/scheduled";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { batch, type Component, createSignal, Show, startTransition, Suspense } from "solid-js";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import { TreeSkeleton } from "#web/components/tree";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import {
  deleteShares,
  revalidateShares,
  type Share,
  type SharedEntry,
  type ShareKind,
  sharedEntriesQuery,
  sharesQuery,
  type SharingPolicy,
  sharingPolicyQuery
} from "#web/lib/data";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { ShareDialog } from "../../share-dialog";
import { IdentifiedVisitors } from "./identified-visitors";
import { SharedEntriesTree } from "./shared-entries-tree";

interface PolicyChange {
  changes: Partial<SharingPolicy>;
  label: string;
  enabled: boolean;
  entries: SharedEntry[];
  /** More entries may be affected than listed. */
  more: boolean;
}

const SWITCH_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" }
];
const MAX_EXPIRY_OPTIONS = [
  { value: "none", label: "No limit" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" }
];
const KIND_OPTIONS = [
  { value: "all", label: "All" },
  { value: "link", label: "Links" },
  { value: "email", label: "Emails" }
];

const isActive = (share: Share) => !share.expiresAt || new Date(share.expiresAt) > new Date();
const SharingSettingsPage: Component = () => {
  const { hasPermission } = useWorkspace();
  const notify = useNotify();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  const [kind, setKind] = createSignal("all");
  const [search, setSearch] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [pageCount, setPageCount] = createSignal(1);
  const [removal, setRemoval] = createSignal<SharedEntry[]>([]);
  const [policyChange, setPolicyChange] = createSignal<PolicyChange | null>(null);
  // Kept while the dialog closes.
  const [dialogEntry, setDialogEntry] = createSignal<SharedEntry | null>(null);
  const [dialogOpened, setDialogOpened] = createSignal(false);
  const [loadingPage, setLoadingPage] = createSignal(false);
  // Hidden until saved and reloaded.
  const [removedIDs, setRemovedIDs] = createSignal<string[]>([]);
  const policy = createAsync(() => sharingPolicyQuery());
  const sharedEntries = createAsync(() => {
    return sharedEntriesQuery({
      kind: kind() === "all" ? undefined : (kind() as ShareKind),
      search: query(),
      pageCount: pageCount()
    });
  });
  const canManagePolicy = () => hasPermission("workspace");
  // Pending until the policy reloads, so the change shows until then.
  const policyMutation = createMutation(() => ({
    mutationFn: (changes: Partial<SharingPolicy>) => client.shares.updatePolicy(changes),
    onSuccess: () => revalidate(sharingPolicyQuery.key),
    onError: (error) => {
      console.error(error);
      notify({ type: "error", text: "Failed to change the sharing settings" });
    }
  }));
  const removeMutation = createMutation(() => ({
    mutationFn: (removed: SharedEntry[]) => {
      return deleteShares(removed.flatMap(({ shares }) => shares.map(({ id }) => id)));
    },
    onMutate: (removed) => setRemovedIDs((ids) => [...ids, ...removed.map(({ id }) => id)]),
    // Also after a failure, as a later batch can fail.
    onSettled: async (_, __, removed) => {
      await revalidateShares();
      setRemovedIDs((ids) => ids.filter((id) => !removed.some((entry) => entry.id === id)));
    },
    onSuccess: (_, removed) => {
      notify({
        type: "success",
        text:
          removed.length > 1 ? `Sharing of ${removed.length} entries disabled` : "Sharing disabled"
      });
    },
    onError: (error) => {
      console.error(error);
      notify({ type: "error", text: "Failed to disable sharing" });
    }
  }));
  const shownPolicy = () => {
    const current = policy();

    return current && policyMutation.isPending
      ? { ...current, ...policyMutation.variables }
      : current;
  };
  const entries = () => {
    return (sharedEntries()?.data ?? []).filter(({ id }) => !removedIDs().includes(id));
  };
  // Transitions keep the current list while the next one loads.
  const updateQuery = debounce((value: string) => {
    void startTransition(() => {
      batch(() => {
        setQuery(value.trim());
        setPageCount(1);
      });
    });
  }, 250);
  const changeKind = (value: string) => {
    // Clicking the selected option sends an empty value; it stays selected.
    if (!value) return;

    void startTransition(() => {
      batch(() => {
        setKind(value);
        setPageCount(1);
      });
    });
  };
  // Confirms only when active shares are affected.
  const changeSharing = async (shareKind: ShareKind, enabled: boolean) => {
    const label = shareKind === "link" ? "link sharing" : "email sharing";
    const changes = shareKind === "link" ? { linkSharing: enabled } : { emailSharing: enabled };
    const page = await client.shares.listEntries({ kind: shareKind, limit: 25 }).catch((error) => {
      console.error(error);
      notify({ type: "error", text: "Failed to check the shared entries" });
    });

    if (!page) return;

    const affected = page.data.filter(({ shares }) => {
      return shares.some((share) => share.kind === shareKind && isActive(share));
    });

    // Later pages can have active shares too, so they're confirmed as well.
    const isAffected = affected.length > 0 || page.pagination.hasMore;

    if (isAffected) {
      setPolicyChange({
        changes,
        label,
        enabled,
        entries: affected,
        more: page.pagination.hasMore
      });
    } else {
      policyMutation.mutate(changes);
    }
  };
  const confirmPolicyChange = () => {
    policyMutation.mutate(policyChange()!.changes);
    setPolicyChange(null);
  };
  const remove = () => {
    removeMutation.mutate(removal());
    setRemoval([]);
  };
  // Transitions are global, so the button tracks its own.
  const loadMore = () => {
    setLoadingPage(true);
    void startTransition(() => setPageCount((current) => current + 1)).then(() => {
      setLoadingPage(false);
    });
  };
  const openEntry = (entryID: string) => navigate(`/${params.workspaceID ?? ""}/${entryID}`);
  const openSharing = async (entry: SharedEntry) => {
    try {
      await Promise.all([sharesQuery(entry.id), sharingPolicyQuery()]);
      setDialogEntry(entry);
      setDialogOpened(true);
    } catch (error) {
      console.error(error);
      notify({ type: "error", text: "Failed to load sharing" });
    }
  };

  return (
    <>
      <ActionConfirmationDialog
        opened={removal().length > 0}
        title={
          removal().length > 1
            ? `Disable sharing of ${removal().length} entries?`
            : "Disable sharing of the entry?"
        }
        description="Their links and email shares are removed. Visitors lose access at once. Their comments stay."
        affected={removal().map((entry) => ({
          id: entry.id,
          icon: "i-lucide:file-text",
          label: entry.name
        }))}
        action={{
          color: "danger",
          label: "Disable sharing",
          onClick: remove
        }}
        onClose={() => setRemoval([])}
      />
      <ActionConfirmationDialog
        opened={Boolean(policyChange())}
        title={`Turn ${policyChange()?.enabled ? "on" : "off"} ${policyChange()?.label ?? ""}?`}
        warning={policyChange()?.more ? "Other entries may be affected too." : undefined}
        description={
          policyChange()?.enabled
            ? "The paused shares of these entries work again."
            : "Visitors of these entries lose access until you turn it on again. The shares stay."
        }
        affected={(policyChange()?.entries ?? []).map((entry) => ({
          id: entry.id,
          icon: "i-lucide:file-text",
          label: entry.name
        }))}
        action={{
          color: policyChange()?.enabled ? "primary" : "danger",
          label: policyChange()?.enabled ? "Turn on" : "Turn off",
          onClick: confirmPolicyChange
        }}
        onClose={() => setPolicyChange(null)}
      />
      <Show when={dialogEntry()}>
        {(entry) => (
          <Suspense>
            <ShareDialog
              entryID={entry().id}
              entryName={entry().name}
              opened={dialogOpened()}
              onClose={() => setDialogOpened(false)}
            />
          </Suspense>
        )}
      </Show>
      <SettingsSection label="Policy">
        <Setting
          label="Link sharing"
          description="Anyone with an entry's link can open it. Turning it off pauses all links."
        >
          <ToggleGroup
            disabled={!canManagePolicy() || !policy() || policyMutation.isPending}
            value={shownPolicy()?.linkSharing === false ? "off" : "on"}
            setValue={(value) => value && changeSharing("link", value === "on")}
            options={SWITCH_OPTIONS}
          />
        </Setting>
        <Setting
          label="Email sharing"
          description="Invited people sign in with their email. Turning it off pauses all invites."
        >
          <ToggleGroup
            disabled={!canManagePolicy() || !policy() || policyMutation.isPending}
            value={shownPolicy()?.emailSharing === false ? "off" : "on"}
            setValue={(value) => value && changeSharing("email", value === "on")}
            options={SWITCH_OPTIONS}
          />
        </Setting>
        <Setting
          label="Maximum expiry"
          description="New and changed shares expire within this time."
        >
          <Select
            class="w-full max-w-48"
            disabled={!canManagePolicy() || !policy() || policyMutation.isPending}
            options={MAX_EXPIRY_OPTIONS}
            value={shownPolicy()?.maxExpiryDays ? `${shownPolicy()!.maxExpiryDays}` : "none"}
            setValue={(value) => {
              policyMutation.mutate({ maxExpiryDays: value === "none" ? null : Number(value) });
            }}
          />
        </Setting>
      </SettingsSection>
      <SettingsSection label="Shared">
        <Setting
          label="Shared entries"
          description="Entries that people outside the workspace can open"
          fade={false}
        >
          <ToggleGroup value={kind()} setValue={changeKind} options={KIND_OPTIONS} />
        </Setting>
        <Input
          class="mb-2"
          placeholder="Search entries or emails"
          value={search()}
          setValue={(value) => {
            setSearch(value);
            updateQuery(value);
          }}
        />
        <Suspense
          fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={2} size="medium" />}
        >
          <Show
            when={entries().length}
            fallback={
              <Card
                class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
                shade
              >
                <div class="i-tabler:world-share h-5.5 w-5.5 text-gray-300" />
                {query() || kind() !== "all" ? "No entries match" : "No entries are shared yet"}
              </Card>
            }
          >
            <SharedEntriesTree
              entries={entries()}
              onOpenEntry={openEntry}
              onOpenSharing={openSharing}
              onRemove={setRemoval}
            />
          </Show>
          <Show when={sharedEntries()?.pagination.hasMore}>
            <Button
              variant="ghost"
              text="soft"
              class="mt-1 w-full"
              loading={loadingPage()}
              onClick={loadMore}
            >
              Load more
            </Button>
          </Show>
        </Suspense>
        <Setting
          label="Identified visitors"
          description="People that entries are shared with individually by email"
          fade={false}
        />
        <IdentifiedVisitors />
      </SettingsSection>
    </>
  );
};

export default SharingSettingsPage;
