import clsx from "clsx";
import { BlockArea, Box, ContentSlot, Element, Icon, Text } from "@andesine/extensions/solid";

interface NoteProps {
  tone?: "info" | "warning";
}
interface ElementViewProps {
  /** The element name, e.g. `Note`. */
  element: string;
  /** The element's props from the document; its menu edits them, from the config's `props`. */
  props: NoteProps;
  /** The element's node ID, e.g. for a `BlockArea` that drags it. */
  key: string;
  /** Whether the editor drags the element. */
  dragged: boolean;
}

const ICONS = { info: "i-lucide:info", warning: "i-lucide:triangle-alert" };

/**
 * The `<Note>` view. The icon drags the note, opens its menu, which edits its tone, and selects
 * it in a box selection; `ContentSlot` shows the editable content, whose blocks get their own drag
 * handle and menu.
 */
export const NoteView = (props: ElementViewProps) => (
  <Box
    padding="none"
    background="soft"
    border
    class={clsx("flex gap-3 rounded-lg", props.dragged && "opacity-50")}
  >
    <BlockArea block={props.key} draggable menu selectable>
      <Box padding="none" class="cursor-grab self-stretch py-3 pl-4 active:cursor-grabbing">
        <Icon name={ICONS[props.props.tone ?? "info"]} />
      </Box>
    </BlockArea>
    {/* The padding is the slot's, so it counts as content for the drag handle and drops. */}
    <ContentSlot
      controls
      class="min-w-0 flex-1 py-3 pr-4"
      contentClass="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      placeholder="Write the note"
    >
      {/* Draws each `<NoteTitle>` in the note; it holds its own text. */}
      <Element tag="NoteTitle">
        {() => (
          <Text weight="semibold" class="uppercase tracking-wide">
            <ContentSlot placeholder="Title" />
          </Text>
        )}
      </Element>
    </ContentSlot>
  </Box>
);
