import { Button, DropdownMenu, IconButton, TagInput } from "@andesine/components";
import { type Component, createSignal } from "solid-js";
import { useNotify } from "#web/context/notifications";
import {
  ACCESS_LABELS,
  EXPIRY_OPTIONS,
  getExpiryOptions,
  getSettingsItems,
  type ShareAccess,
  toExpiresAt
} from "./settings";

interface InviteViewProps {
  menuMount?: HTMLElement;
  maxExpiryDays: number | null;
  pending: boolean;
  onBack(): void;
  /** Resolves with the emails not invited yet. */
  onInvite(emails: string[], access: ShareAccess, expiresAt: string | null): Promise<string[]>;
}

const MAX_INVITES = 50;

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const InviteView: Component<InviteViewProps> = (props) => {
  const notify = useNotify();
  const [addresses, setAddresses] = createSignal<string[]>([]);
  const [draft, setDraft] = createSignal("");
  const [access, setAccess] = createSignal<ShareAccess>("view");
  // The longest allowed by the workspace.
  const [expiry, setExpiry] = createSignal(
    props.maxExpiryDays ? getExpiryOptions(props.maxExpiryDays).at(-1)!.value : "never"
  );
  const [settingsOpened, setSettingsOpened] = createSignal(false);
  const expiryLabel = () => {
    const label = EXPIRY_OPTIONS.find(({ value }) => value === expiry())?.label;

    return expiry() === "never" ? label : `Expires in ${label}`;
  };
  // Typed text counts too, as the click that invites adds it as a tag first.
  const isValid = () => {
    return (addresses().length > 0 || Boolean(draft().trim())) && addresses().every(isEmail);
  };
  const invite = async () => {
    if (!isValid() || !addresses().length) return;

    setAddresses(await props.onInvite(addresses(), access(), toExpiresAt(expiry())));
  };
  // A pasted list becomes one tag per address.
  const setValues = (values: string[]) => {
    const split = values.flatMap((value) => value.toLowerCase().split(/[\s,;]+/));
    const unique = [...new Set(split.filter(Boolean))];

    if (unique.length > MAX_INVITES) {
      notify({ type: "error", text: `Only the first ${MAX_INVITES} addresses were added` });
    }

    setAddresses(unique.slice(0, MAX_INVITES));
  };

  return (
    <>
      <div class="flex flex-col gap-0.5">
        <h3 class="text-lg font-semibold leading-tight">Invite people</h3>
        <p class="text-sm leading-tight text-gray-400">
          Allow signed in users with specific email address to view or comment on this entry.
        </p>
      </div>
      <TagInput
        values={addresses()}
        setValues={setValues}
        placeholder="Email addresses"
        color="contrast"
        tagsFirst
        tagListClass="max-h-32 overflow-y-auto scrollbar-sm"
        maxValues={MAX_INVITES}
        onInputChange={setDraft}
        validate={(values) => {
          return values.every(isEmail) ? undefined : "Use valid email addresses";
        }}
      />
      <div class="flex flex-col gap-1 text-xs">
        <span>Sharing settings</span>
        {/* Portaled past the list's scroll, into the dialog for its focus trap. */}
        <DropdownMenu
          class="w-full"
          title="Invite settings"
          opened={settingsOpened()}
          setOpened={setSettingsOpened}
          placement="bottom-start"
          cardProps={{ class: "w-52" }}
          portalMount={props.menuMount}
          items={[
            getSettingsItems({
              access: access(),
              expiry: expiry(),
              maxExpiryDays: props.maxExpiryDays,
              setAccess,
              setExpiry
            })
          ]}
          trigger={() => (
            <Button class="flex w-full items-center gap-1 text-sm" variant="secondary">
              <span class="px-1">{ACCESS_LABELS[access()]}</span>
              <span class="h-3 w-px shrink-0 bg-gray-400 opacity-20" />
              <span class="px-1">{expiryLabel()}</span>
              <div class="i-lucide:chevrons-up-down ml-auto h-4 w-4 shrink-0 text-gray-400" />
            </Button>
          )}
        />
      </div>
      <div class="flex gap-2">
        <IconButton icon="i-lucide:arrow-left" disabled={props.pending} onClick={props.onBack} />
        <Button
          class="flex-1"
          variant="primary"
          loading={props.pending}
          disabled={!isValid()}
          onClick={invite}
        >
          {addresses().length > 1 ? `Invite ${addresses().length} people` : "Invite"}
        </Button>
      </div>
    </>
  );
};

export { InviteView };
