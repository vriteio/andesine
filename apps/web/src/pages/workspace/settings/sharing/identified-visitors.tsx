import { Button, Card, IconButton, Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import {
  type Component,
  createMemo,
  createSignal,
  Show,
  startTransition,
  Suspense
} from "solid-js";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import {
  PAGE_TREE_SIZE,
  Tree,
  TREE_ROOT_ID,
  TreeItem,
  type TreeMap,
  TreeSkeleton,
  useTree
} from "#web/components/tree";
import { useNotify } from "#web/context/notifications";
import {
  deleteShares,
  type IdentifiedVisitor,
  identifiedVisitorsQuery,
  revalidateShares
} from "#web/lib/data";
import { formatCount } from "./shared-entry-item";

interface VisitorListProps {
  visitors: IdentifiedVisitor[];
  onRevoke(visitors: IdentifiedVisitor[]): void;
}
interface VisitorItemProps {
  visitor: IdentifiedVisitor;
  getVisitors(emails: string[]): IdentifiedVisitor[];
  onRevoke(visitors: IdentifiedVisitor[]): void;
}

const VisitorItem: Component<VisitorItemProps> = (props) => {
  const [{ selection }] = useTree();
  // A selected row acts on the whole selection.
  const targets = () => {
    const selected = selection().includes(props.visitor.email) ? selection() : [];

    return selected.length > 1 ? props.getVisitors(selected) : [props.visitor];
  };
  const label = () => {
    const count = targets().length;

    return count > 1 ? `Revoke access of ${count} people` : "Revoke access";
  };
  // The selection stays, so Cancel in the dialog keeps it.
  const revoke = () => props.onRevoke(targets());

  return (
    <TreeItem
      id={props.visitor.email}
      label={props.visitor.email}
      topLevel
      selectable
      checkbox
      keyboardMenu={[{ label: label(), icon: "i-lucide:user-x", color: "danger", onClick: revoke }]}
      onClick={revoke}
      class="px-1 py-0.5"
      icon={<div class="i-lucide:mail h-5.5 w-5.5 text-gray-400" />}
      renderLabel={(text) => (
        <div class="flex min-w-0 flex-1 items-center gap-1.5" title={props.visitor.email}>
          <div class="min-w-0 truncate">{text}</div>
          <div class="flex-1" />
          <span class="shrink-0 text-xs text-gray-400">
            {formatCount(props.visitor.entries, "entry", "entries")}
          </span>
        </div>
      )}
      actions={
        <Tooltip content={label()} fixed>
          <IconButton
            icon="i-lucide:user-x"
            variant="ghost"
            aria-label={label()}
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              revoke();
            }}
          />
        </Tooltip>
      }
    />
  );
};
const VisitorList: Component<VisitorListProps> = (props) => {
  const visitors = createMemo(
    () => new Map(props.visitors.map((visitor) => [visitor.email, visitor]))
  );
  const treeMap = createMemo<TreeMap>(() => ({
    [TREE_ROOT_ID]: { items: props.visitors.map(({ email }) => email), levels: [] }
  }));
  const getVisitors = (emails: string[]) => emails.flatMap((email) => visitors().get(email) || []);

  return (
    <Tree
      keyboard
      tree={treeMap}
      {...PAGE_TREE_SIZE}
      renderItem={(email) => (
        <Show when={visitors().get(email)}>
          {(visitor) => (
            <VisitorItem visitor={visitor()} getVisitors={getVisitors} onRevoke={props.onRevoke} />
          )}
        </Show>
      )}
    />
  );
};
const IdentifiedVisitors: Component = () => {
  const notify = useNotify();
  const [pageCount, setPageCount] = createSignal(1);
  const [revoked, setRevoked] = createSignal<IdentifiedVisitor[]>([]);
  const [loadingPage, setLoadingPage] = createSignal(false);
  // Hidden until saved and reloaded.
  const [revokedEmails, setRevokedEmails] = createSignal<string[]>([]);
  const visitors = createAsync(() => identifiedVisitorsQuery(pageCount()));
  const revokeMutation = createMutation(() => ({
    mutationFn: (removed: IdentifiedVisitor[]) => {
      return deleteShares(removed.flatMap(({ shareIDs }) => shareIDs));
    },
    onMutate: (removed) => {
      setRevokedEmails((emails) => [...emails, ...removed.map(({ email }) => email)]);
    },
    // Also after a failure, as a later batch can fail.
    onSettled: async (_, __, removed) => {
      await revalidateShares();
      setRevokedEmails((emails) => {
        return emails.filter((email) => !removed.some((visitor) => visitor.email === email));
      });
    },
    onSuccess: (_, removed) => {
      notify({
        type: "success",
        text: removed.length > 1 ? `Access of ${removed.length} people revoked` : "Access revoked"
      });
    },
    onError: (error) => {
      console.error(error);
      notify({ type: "error", text: "Failed to revoke access" });
    }
  }));
  // Transitions are global, so the button tracks its own.
  const loadMore = () => {
    setLoadingPage(true);
    void startTransition(() => setPageCount((current) => current + 1)).then(() => {
      setLoadingPage(false);
    });
  };
  const shownVisitors = () => {
    return (visitors()?.data ?? []).filter(({ email }) => !revokedEmails().includes(email));
  };
  const revoke = () => {
    revokeMutation.mutate(revoked());
    setRevoked([]);
  };

  return (
    <>
      <ActionConfirmationDialog
        opened={revoked().length > 0}
        title={
          revoked().length > 1
            ? `Revoke access of ${revoked().length} people?`
            : `Revoke access of ${revoked()[0]?.email ?? ""}?`
        }
        description="Their email shares are removed. They lose access at once. Their comments stay."
        affected={revoked().map((visitor) => ({
          id: visitor.email,
          icon: "i-lucide:mail",
          label: visitor.email,
          detail: formatCount(visitor.entries, "entry", "entries")
        }))}
        action={{
          color: "danger",
          label: "Revoke access",
          onClick: revoke
        }}
        onClose={() => setRevoked([])}
      />
      <Suspense fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={2} size="medium" />}>
        <Show
          when={shownVisitors().length}
          fallback={
            <Card
              class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
              shade
            >
              <div class="i-lucide:mail h-5.5 w-5.5 text-gray-300" />
              No entries are shared by email yet
            </Card>
          }
        >
          <VisitorList visitors={shownVisitors()} onRevoke={setRevoked} />
        </Show>
        <Show when={visitors()?.pagination.hasMore}>
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
    </>
  );
};

export { IdentifiedVisitors };
