import { Button, DropdownMenu, type MenuItem, Tooltip } from "@andesine/components";
import clsx from "clsx";
import { type Component, createSignal, Show } from "solid-js";

interface EditingModeMenuProps {
  suggesting: boolean;
  canEdit: boolean;
  /** Icon only, beside the publishing menu. */
  compact: boolean;
  /** Unset without suggestions to show. */
  suggestionsShown?: boolean;
  setSuggesting(suggesting: boolean): void;
  setSuggestionsShown(shown: boolean): void;
}
interface EditingMode {
  label: string;
  icon: string;
}

const SUGGESTING_MODE: EditingMode = {
  label: "Suggesting",
  icon: "i-material-symbols:rate-review-outline-rounded"
};
const EDITING_MODE: EditingMode = { label: "Editing", icon: "i-lucide:pencil" };
const COMMENTING_MODE: EditingMode = { label: "Commenting", icon: "i-tabler:message" };
const EditingModeMenu: Component<EditingModeMenuProps> = (props) => {
  const [opened, setOpened] = createSignal(false);
  const directMode = () => (props.canEdit ? EDITING_MODE : COMMENTING_MODE);
  const mode = () => (props.suggesting ? SUGGESTING_MODE : directMode());
  const items = (): MenuItem[][] => {
    const shown = props.suggestionsShown;
    const modes: MenuItem[] = [
      { type: "header", label: "Mode" },
      ...[directMode(), SUGGESTING_MODE].map((option) => ({
        ...option,
        selected: option === mode(),
        onClick: () => props.setSuggesting(option === SUGGESTING_MODE)
      }))
    ];

    if (shown === undefined) return [modes];

    return [
      modes,
      [
        {
          label: shown ? "Hide suggestions" : "Show suggestions",
          icon: shown ? "i-lucide:eye-off" : "i-lucide:eye",
          onClick: () => props.setSuggestionsShown(!shown)
        }
      ]
    ];
  };

  return (
    <DropdownMenu
      title="Mode"
      cardProps={{ class: "w-44" }}
      items={items()}
      opened={opened()}
      setOpened={setOpened}
      trigger={() => (
        <Tooltip content={mode().label} placement="bottom" fixed enabled={props.compact}>
          <Button
            class={clsx("flex min-w-0 items-center", props.compact ? "gap-0.5" : "justify-start")}
            variant="secondary"
            aria-label="Editing mode"
          >
            <div class="flex h-5 w-5 items-center justify-center">
              <div class={clsx(mode().icon, "h-4.5 w-4.5 shrink-0 text-gray-400")} />
            </div>
            <Show when={!props.compact}>
              <span class="hidden min-w-0 truncate px-1 md:inline">{mode().label}</span>
            </Show>
            <div
              class={clsx(
                "i-lucide:chevrons-up-down ml-auto shrink-0 text-gray-400",
                props.compact && "h-3.5 w-3.5"
              )}
            />
          </Button>
        </Tooltip>
      )}
    />
  );
};

export { EditingModeMenu };
