import {
  Box,
  ContentSlot,
  Icon,
  Stack,
  Text,
  ToggleGroup,
  useEditor
} from "@andesine/extensions/solid";

interface ElementViewProps {
  /** The element name, e.g. `Note`. */
  element: string;
  /** The element's props from the document. */
  props: { tone?: string };
}

const tones = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" }
];

/** The `<Note>` view: `ContentSlot` shows the editable content; the toggle edits element props. */
export const NoteView = (props: ElementViewProps) => {
  const editor = useEditor();
  const tone = () => props.props.tone ?? "info";

  return (
    <Box padding="medium" background="soft" border class="rounded-lg">
      <Stack gap="small">
        <Stack direction="row" justify="between" align="center">
          <Icon name={tone() === "warning" ? "i-lucide:triangle-alert" : "i-lucide:info"} />
          <ToggleGroup
            value={tone()}
            options={tones}
            onChange={(value) => editor.setElementProps({ tone: value })}
          />
        </Stack>
        <ContentSlot />
      </Stack>
    </Box>
  );
};
/** The view of `<NoteTitle>` elements inside a note, from the note view's descendants. */
export const NoteTitleView = () => {
  return (
    <Text weight="semibold" class="uppercase tracking-wide">
      <ContentSlot />
    </Text>
  );
};
