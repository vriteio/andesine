import { createClient } from "@andesine/sdk";
import {
  apiFetch,
  backend,
  Button,
  copyText,
  Dialog,
  EXTENSION_API_URL,
  hasPermission,
  IconButton,
  Menu,
  MenuItem,
  MenuTrigger,
  notify,
  Stack,
  Text,
  useConfiguration
} from "@andesine/extensions/solid";
import { createResource, createSignal, Show } from "solid-js";

interface HelloPanelProps {
  /** Right panels with the `entry` context get the open entry's ID. */
  entryID?: string;
}

// API calls go through Andesine with the member's session, limited to the extension's grant.
const client = createClient({ baseURL: EXTENSION_API_URL, fetch: apiFetch });

/** The right panel: reads the open entry through the API, then asks the backend who you are. */
export const HelloPanel = (props: HelloPanelProps) => {
  const configuration = useConfiguration<{ greeting: string }>();
  const [name, setName] = createSignal<string | null>(null);
  const [failed, setFailed] = createSignal(false);
  const [aboutOpened, setAboutOpened] = createSignal(false);
  const [entry] = createResource(
    () => (hasPermission("read:entries") ? props.entryID : undefined),
    // A failed request would end the view, so the entry line stays hidden instead.
    (id) => client.entries.get({ id }).catch(() => null)
  );
  const greeting = () => `${configuration().greeting ?? "Hello"}, ${name() ?? "member"}!`;
  const copyGreeting = async () => {
    await copyText(greeting());
    await notify("Greeting copied");
  };
  const askBackend = async () => {
    try {
      const response = await backend.fetch("/hello", { method: "POST" });
      const result = (await response.json()) as { name: string };

      setName(result.name);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Stack gap="small">
      <Stack direction="row" justify="between" align="center">
        <Text>{greeting()}</Text>
        {/* Menus and dialogs work in any view; a dialog opens only right after an interaction. */}
        <Menu>
          <MenuTrigger>
            <IconButton icon="i-lucide:ellipsis" label="More" />
          </MenuTrigger>
          <MenuItem label="Copy greeting" icon="i-lucide:copy" onSelect={copyGreeting} />
          <MenuItem
            label="About this panel"
            icon="i-lucide:info"
            onSelect={() => setAboutOpened(true)}
          />
        </Menu>
      </Stack>
      <Show when={aboutOpened()}>
        <Dialog title="Hello panel" size="small" onClose={() => setAboutOpened(false)}>
          <Text size="sm">
            A sample panel: it reads the open entry and asks the extension's backend who you are.
          </Text>
        </Dialog>
      </Show>
      <Show when={entry()}>
        {(loaded) => (
          <Text size="sm" tone="muted">
            Entry: {loaded().name}
          </Text>
        )}
      </Show>
      <Button onClick={askBackend}>Ask the backend</Button>
      <Show when={failed()}>
        <Text tone="danger">The backend did not answer.</Text>
      </Show>
    </Stack>
  );
};
