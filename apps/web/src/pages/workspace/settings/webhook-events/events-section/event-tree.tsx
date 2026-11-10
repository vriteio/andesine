import { type Component, createMemo, Show } from "solid-js";
import { Tree, TREE_ROOT_ID, type TreeMap } from "#web/components/tree";
import type { WebhookEvent } from "#web/lib/data";
import type { WebhookEventsSource } from "../source";
import { EventItem } from "./event-item";
import { EVENT_ITEM_HEIGHT } from "./event-skeleton";

interface EventTreeProps {
  events: WebhookEvent[];
  source: WebhookEventsSource;
  onReplay(events: WebhookEvent[]): void;
}

const EventTree: Component<EventTreeProps> = (props) => {
  const events = createMemo(() => {
    return new Map(props.events.map((event) => [event.id, event]));
  });
  const order = createMemo(() => props.events.map((event) => event.id));
  const getEvents = (ids: string[]) => {
    return ids.flatMap((id) => events().get(id) || []);
  };
  const treeMap = createMemo<TreeMap>(() => {
    const map: TreeMap = {
      [TREE_ROOT_ID]: { items: [], levels: props.events.map((event) => event.id) }
    };

    for (const event of props.events) map[event.id] = { items: [], levels: [] };

    return map;
  });

  return (
    // Rows draw their own selection backdrop, because the Tree's backdrop assumes fixed row heights.
    <Tree
      keyboard
      tree={treeMap}
      itemHeight={EVENT_ITEM_HEIGHT}
      selectionTransform={() => []}
      renderLevel={(id) => (
        // A row can re-render briefly after its event leaves the list, e.g. on a filter change.
        <Show when={events().get(id)}>
          {(event) => (
            <EventItem
              event={event()}
              previousID={order()[order().indexOf(id) - 1]}
              nextID={order()[order().indexOf(id) + 1]}
              getEvents={getEvents}
              source={props.source}
              onReplay={props.onReplay}
            />
          )}
        </Show>
      )}
    />
  );
};

export { EventTree };
