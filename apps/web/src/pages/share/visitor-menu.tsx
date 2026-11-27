import {
  Button,
  Dialog,
  DropdownArea,
  DropdownMenu,
  IconButton,
  Input,
  type MenuItem
} from "@andesine/components";
import { toUserID } from "@andesine/contracts/primitives";
import { createAsync, useLocation } from "@solidjs/router";
import { type Component, createSignal, type JSX, Show } from "solid-js";
import { listSessionsQuery, listWorkspacesQuery } from "#web/context/workspace";
import { authClient, client } from "#web/lib/api";
import { appendRedirectTo } from "#web/lib/navigation";
import { AccountHeader, ProfileMenu } from "../workspace/profile-menu";

interface VisitorUser {
  /** The account ID as Better Auth gives it. */
  id: string;
  name: string;
  email: string;
  image?: string | null;
}
interface VisitorMenuProps {
  name: string | null;
  /** The signed-in account, which names the visitor. */
  user: VisitorUser | null;
  canRename: boolean;
  onRename(name: string | null): Promise<void>;
}
interface AccountMenuProps {
  user: VisitorUser;
  trigger(): JSX.Element;
}
interface NameDialogProps {
  opened: boolean;
  name: string | null;
  onClose(): void;
  onSave(name: string | null): Promise<void>;
}

type MenuEntry = MenuItem | (() => JSX.Element);

const NameDialog: Component<NameDialogProps> = (props) => {
  const [name, setName] = createSignal(props.name ?? "");
  const [saving, setSaving] = createSignal(false);
  const save = async () => {
    setSaving(true);

    try {
      await props.onSave(name().trim() || null);
      props.onClose();
    } catch {
      // Reported by the save.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog opened={props.opened} onOverlayClick={props.onClose} size="small" aria-label="Name">
      <div class="flex flex-col gap-0.5">
        <h3 class="text-lg font-semibold leading-tight">Your name</h3>
        <p class="text-sm leading-tight text-gray-400">
          Shown with your comments and suggestions. Leave it empty to stay anonymous.
        </p>
      </div>
      <Input
        value={name()}
        setValue={setName}
        maxLength={50}
        placeholder="Anonymous"
        disabled={saving()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
        }}
      />
      <div class="flex gap-2">
        <IconButton icon="i-lucide:x" disabled={saving()} onClick={props.onClose} />
        <Button class="flex-1" loading={saving()} onClick={save}>
          Save
        </Button>
      </div>
    </Dialog>
  );
};
/** The signed-in accounts' menu, without a workspace context. */
const AccountMenu: Component<AccountMenuProps> = (props) => {
  const location = useLocation();
  const sessions = createAsync(() => listSessionsQuery());
  const workspaces = createAsync(() => listWorkspacesQuery());
  const currentUserID = () => toUserID(props.user.id);
  const switchWorkspace = async (workspaceID: string, userID?: string) => {
    const target = (sessions() ?? []).find((session) => session.user.id === userID);

    if (target && userID !== currentUserID()) {
      const { error } = await authClient.multiSession.setActive({
        sessionToken: target.sessionToken
      });

      if (error) throw error;
    }

    await client.workspaces.switch({ workspaceID });
    window.location.href = `/${workspaceID}/`;
  };

  return (
    <ProfileMenu
      account={{
        currentWorkspace: () => undefined,
        workspaces: () => workspaces() ?? [],
        sessions: () => sessions() ?? [],
        switchWorkspace,
        currentUserID
      }}
      placement="bottom-end"
      returnPath={location.pathname}
      trigger={props.trigger}
    />
  );
};
const VisitorMenu: Component<VisitorMenuProps> = (props) => {
  const location = useLocation();
  const [opened, setOpened] = createSignal(false);
  const [naming, setNaming] = createSignal(false);
  const displayName = () => props.user?.name || props.name || "Anonymous";
  const items = (): MenuEntry[][] => [
    [() => <AccountHeader name={displayName()} detail="Not signed in" />],
    [
      ...(props.canRename
        ? [{ label: "Set name", icon: "i-lucide:pencil", onClick: () => setNaming(true) }]
        : []),
      {
        label: "Sign in to Andesine",
        icon: "i-lucide:log-in",
        onClick: () => {
          window.location.assign(appendRedirectTo("/auth/sign-in", location.pathname));
        }
      }
    ]
  ];
  const trigger = () => (
    <Button class="flex min-w-0 items-center" variant="secondary" aria-label="Account">
      <div class="flex h-5 w-5 items-center justify-center">
        <Show
          when={props.user?.image}
          fallback={<div class="i-lucide:circle-user h-4.5 w-4.5 shrink-0 text-gray-400" />}
        >
          {(image) => (
            <img
              src={image()}
              alt={`${displayName()} avatar`}
              class="h-4.5 w-4.5 shrink-0 rounded object-contain"
            />
          )}
        </Show>
      </div>
      <span class="hidden max-w-32 min-w-0 truncate px-1 md:inline">{displayName()}</span>
      <div class="i-lucide:chevrons-up-down ml-auto shrink-0 text-gray-400" />
    </Button>
  );

  return (
    <Show
      when={props.user}
      fallback={
        <>
          {/* Mounted on open, so it starts with the current name. */}
          <Show when={naming()}>
            <NameDialog
              opened
              name={props.name}
              onClose={() => setNaming(false)}
              onSave={props.onRename}
            />
          </Show>
          <DropdownArea>
            <DropdownMenu
              title="Account"
              cardProps={{ class: "w-56" }}
              opened={opened()}
              setOpened={setOpened}
              placement="bottom-end"
              trigger={trigger}
              items={items()}
            />
          </DropdownArea>
        </>
      }
    >
      {(user) => <AccountMenu user={user()} trigger={trigger} />}
    </Show>
  );
};
export { VisitorMenu };
export type { VisitorUser };
