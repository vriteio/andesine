import { Input } from "@andesine/components";
import clsx from "clsx";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import {
  webhookCatalogEvents,
  webhookEventCategories,
  type WebhookCatalogEvent,
  type WebhookEventType
} from "#web/lib/data";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import type { WebhookDraft } from "./configuration";
import { SelectableRow } from "./selectable-row";

interface EventsSectionProps {
  disabled: boolean;
  draft: WebhookDraft;
  setDraft: SetStoreFunction<WebhookDraft>;
}
interface EventRowProps {
  disabled: boolean;
  event: WebhookCatalogEvent;
  selected: boolean;
  setSelected(selected: boolean): void;
}
interface EventCategoryProps {
  disabled: boolean;
  events: WebhookCatalogEvent[];
  label: string;
  selected: Set<WebhookEventType>;
  setSelected(types: WebhookEventType[], selected: boolean): void;
}

const EventRow: Component<EventRowProps> = (props) => (
  <SelectableRow
    label={<span class="break-all font-mono text-sm">{props.event.type}</span>}
    description={props.event.description}
    checked={props.selected}
    disabled={props.disabled}
    setChecked={props.setSelected}
  />
);
const EventCategory: Component<EventCategoryProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const selectedCount = () => props.events.filter((event) => props.selected.has(event.type)).length;
  const checked = () => {
    if (selectedCount() === 0) return false;

    return selectedCount() === props.events.length ? true : "indeterminate";
  };

  return (
    <div class="flex flex-col">
      <SelectableRow
        label={props.label}
        description={`${selectedCount()} of ${props.events.length} selected`}
        leading={
          <div
            class={clsx(
              "i-lucide:chevron-right h-4 w-4 text-gray-400 transition-transform",
              expanded() && "rotate-90"
            )}
          />
        }
        checked={checked()}
        disabled={props.disabled}
        onClick={() => setExpanded((current) => !current)}
        setChecked={(selected) => {
          props.setSelected(
            props.events.map((event) => event.type),
            selected
          );
        }}
      />
      <Show when={expanded()}>
        {/* Guide line under the chevron, like explorer tree levels. */}
        <div class="flex">
          <div class="flex w-4 shrink-0 justify-center py-1">
            <div class="h-full w-px rounded-full bg-gray-300" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col pl-1.5">
            <For each={props.events}>
              {(event) => (
                <EventRow
                  event={event}
                  selected={props.selected.has(event.type)}
                  disabled={props.disabled}
                  setSelected={(selected) => props.setSelected([event.type], selected)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};
const EventsSection: Component<EventsSectionProps> = (props) => {
  const [search, setSearch] = createSignal("");
  const selected = createMemo(() => new Set(props.draft.eventTypes));
  // Search filters the bundled catalog locally and shows a flat list instead of categories.
  const searchResults = createMemo(() => {
    const query = search().trim().toLowerCase();

    if (!query) return null;

    return webhookCatalogEvents.filter((event) => {
      return (
        event.type.toLowerCase().includes(query) || event.description.toLowerCase().includes(query)
      );
    });
  });
  const setSelected = (types: WebhookEventType[], isSelected: boolean) => {
    const next = isSelected
      ? [...new Set([...props.draft.eventTypes, ...types])]
      : props.draft.eventTypes.filter((type) => !types.includes(type));

    props.setDraft("eventTypes", next);
  };

  return (
    <SettingsSection label="Events">
      <Setting
        label="Events"
        description="Workspace changes that send a request to this webhook"
        fade={false}
      >
        <Input
          placeholder="Search events"
          variant="outlined"
          color="contrast"
          size="small"
          value={search()}
          setValue={setSearch}
          class="w-full max-w-md"
        />
      </Setting>
      <Show
        when={searchResults()}
        fallback={
          <For each={webhookEventCategories}>
            {(category) => (
              <EventCategory
                label={category.label}
                events={webhookCatalogEvents.filter((event) => event.category === category.id)}
                selected={selected()}
                disabled={props.disabled}
                setSelected={setSelected}
              />
            )}
          </For>
        }
      >
        {(results) => (
          <For
            each={results()}
            fallback={<span class="py-2 text-sm text-gray-400">No matching events</span>}
          >
            {(event) => (
              <EventRow
                event={event}
                selected={selected().has(event.type)}
                disabled={props.disabled}
                setSelected={(isSelected) => setSelected([event.type], isSelected)}
              />
            )}
          </For>
        )}
      </Show>
    </SettingsSection>
  );
};

export { EventsSection };
