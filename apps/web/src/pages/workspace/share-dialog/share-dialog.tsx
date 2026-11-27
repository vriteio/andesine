import { Dialog, IconButton, Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createEffect, createSignal, Match, on, Show, Switch } from "solid-js";
import { ActionConfirmationContent } from "#web/components/action-confirmation-dialog";
import { useClipboard } from "#web/context/clipboard";
import { useNotify } from "#web/context/notifications";
import { client } from "#web/lib/api";
import { revalidateShares, type Share, sharesQuery, sharingPolicyQuery } from "#web/lib/data";
import { InviteView } from "./invite-view";
import { getShareURL, type ShareAccess, type ShareChanges } from "./settings";
import { ShareList } from "./share-list";

interface ShareDialogProps {
  entryID: string;
  entryName: string;
  opened: boolean;
  onClose(): void;
}

const ShareDialog: Component<ShareDialogProps> = (props) => {
  const notify = useNotify();
  const { copyText } = useClipboard();
  const [view, setView] = createSignal<"main" | "invite" | "reset" | "turn-off">("main");
  const [menuMount, setMenuMount] = createSignal<HTMLElement>();
  // Loaded before the dialog opens, and kept while it closes.
  const shares = createAsync(() => sharesQuery(props.entryID));
  const policy = createAsync(() => sharingPolicyQuery());
  const maxExpiryDays = () => policy()?.maxExpiryDays ?? null;
  const linkSharing = () => policy()?.linkSharing ?? true;
  const emailSharing = () => policy()?.emailSharing ?? true;
  const link = () => shares()?.find(({ kind }) => kind === "link");
  const emailShares = () => shares()?.filter(({ kind }) => kind === "email") ?? [];
  const mutation = createMutation(() => ({
    mutationFn: (change: () => Promise<unknown>) => change(),
    // Also after a failure, as a bulk change can fail partway.
    onSettled: () => revalidateShares(),
    onError: (error) => {
      console.error(error);
      notify({ type: "error", text: "Failed to change sharing" });
    }
  }));
  const change = (action: () => Promise<unknown>) => mutation.mutateAsync(action);
  const update = (id: string, changes: ShareChanges) => {
    return change(() => client.shares.update({ id, ...changes }));
  };
  const remove = (id: string) => change(() => client.shares.deleteMany({ ids: [id] }));
  const createLink = (access: ShareAccess = "view", expiresAt: string | null = null) => {
    return change(() => client.shares.createLink({ entryID: props.entryID, access, expiresAt }));
  };
  const copyLink = (share: Share) => {
    return copyText(getShareURL(share), { success: "Link copied" });
  };
  const invite = async (emails: string[], access: ShareAccess, expiresAt: string | null) => {
    const pending = [...emails];

    try {
      await change(async () => {
        while (pending.length) {
          await client.shares.invite({
            entryID: props.entryID,
            email: pending[0],
            access,
            expiresAt
          });
          pending.shift();
        }
      });
      setView("main");
    } catch {
      // Notified by the mutation; the view stays open with the emails left.
    }

    return pending;
  };
  const confirm = async (action: () => Promise<unknown>) => {
    // Notified by the mutation.
    await action().catch(() => undefined);
    setView("main");
  };
  const close = () => props.onClose();

  // On open, not on close, so the closing dialog keeps its view.
  createEffect(
    on(
      () => props.opened,
      (opened) => opened && setView("main")
    )
  );

  return (
    <Dialog
      opened={props.opened && shares() !== undefined && policy() !== undefined}
      onOverlayClick={close}
      size="large"
      cardClass="relative"
      aria-label="Share"
    >
      {/* The menus' portal; out of the layout. */}
      <div ref={setMenuMount} class="absolute left-0 top-0" />
      <Tooltip content="Close" wrapperClass="absolute right-2 top-2" placement="left">
        <IconButton variant="ghost" icon="i-lucide:x" aria-label="Close" onClick={close} />
      </Tooltip>
      <Switch>
        <Match when={view() === "invite"}>
          <InviteView
            menuMount={menuMount()}
            maxExpiryDays={maxExpiryDays()}
            pending={mutation.isPending}
            onBack={() => setView("main")}
            onInvite={invite}
          />
        </Match>
        <Match when={view() === "reset" && link()}>
          {(share) => (
            <ActionConfirmationContent
              title="Reset the link?"
              description="The current link stops working, and people who opened it lose access. Their comments stay."
              affected={[]}
              action={{
                color: "danger",
                label: "Reset link",
                loading: mutation.isPending,
                onClick: () => {
                  // An expired date would make the new link expired too.
                  const expiresAt = share().expiresAt;
                  const isExpired = expiresAt && new Date(expiresAt) <= new Date();

                  void confirm(() => createLink(share().access, isExpired ? null : expiresAt));
                }
              }}
              onClose={() => setView("main")}
            />
          )}
        </Match>
        <Match when={view() === "turn-off" && link()}>
          {(share) => (
            <ActionConfirmationContent
              title="Turn off the link?"
              description="People who opened it lose access at once. Their comments stay."
              affected={[]}
              action={{
                color: "danger",
                label: "Turn off link",
                loading: mutation.isPending,
                onClick: () => {
                  void confirm(() => remove(share().id));
                }
              }}
              onClose={() => setView("main")}
            />
          )}
        </Match>
        {/* Also after the link is turned off, while the view switches back. */}
        <Match when={view() !== "invite"}>
          <div class="flex flex-col gap-0.5">
            <h3 class="truncate pr-8 text-lg font-semibold leading-tight">
              Share "{props.entryName}"
            </h3>
            <p class="text-sm leading-tight text-gray-400">
              Allow people outside the workspace to view or comment on this specific entry.
            </p>
          </div>
          <ShareList
            link={link()}
            emailShares={emailShares()}
            menuMount={menuMount()}
            linkSharing={linkSharing()}
            emailSharing={emailSharing()}
            maxExpiryDays={maxExpiryDays()}
            onUpdate={(id, changes) => {
              void update(id, changes);
            }}
            onRemove={(id) => {
              void remove(id);
            }}
            onResetLink={() => setView("reset")}
            onTurnOffLink={() => setView("turn-off")}
          />
          <Show when={link() && linkSharing()}>
            <p class="text-sm leading-tight text-gray-400">
              The link works until it expires or you turn it off manually.
            </p>
          </Show>
          <div class="flex flex-col gap-1">
            <Show when={linkSharing()}>
              <Show
                when={link()}
                fallback={
                  <IconButton
                    icon="i-lucide:link"
                    iconProps={{ class: "h-4 w-4" }}
                    class="w-full"
                    variant="primary"
                    label="Create link"
                    loading={mutation.isPending}
                    onClick={() => createLink()}
                  />
                }
              >
                {(share) => (
                  <IconButton
                    icon="i-lucide:copy"
                    iconProps={{ class: "h-4 w-4" }}
                    class="w-full"
                    variant="primary"
                    label="Copy link"
                    onClick={() => copyLink(share())}
                  />
                )}
              </Show>
            </Show>
            <Show when={linkSharing() && emailSharing()}>
              <div class="flex items-center gap-2 text-xs text-gray-400">
                <div class="h-px flex-1 bg-gray-200" />
                Or
                <div class="h-px flex-1 bg-gray-200" />
              </div>
            </Show>
            <Show when={emailSharing()}>
              <IconButton
                icon="i-lucide:user-plus"
                iconProps={{ class: "h-4 w-4 text-gray-400" }}
                class="w-full"
                variant="secondary"
                text="base"
                label="Invite people"
                onClick={() => setView("invite")}
              />
            </Show>
          </div>
        </Match>
      </Switch>
    </Dialog>
  );
};

export { ShareDialog };
