import {
  Button,
  type ContentNode,
  Dialog,
  Stack,
  Text,
  ToggleGroup,
  useEditor
} from "@andesine/extensions/solid";
import { createSignal, Show } from "solid-js";

interface BlockActionProps {
  blocks: ContentNode[];
}

const tones = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" }
];

/** A block action in a dialog: it asks for the tone, then wraps the blocks in a `<Note>`. */
export const WrapInNoteAction = (props: BlockActionProps) => {
  const editor = useEditor();
  const [tone, setTone] = createSignal("info");
  const [error, setError] = createSignal<string | null>(null);
  const wrap = async () => {
    try {
      // Andesine derives the element's tag from its name and props.
      await editor.replace([
        { type: "element", attrs: { name: "Note", props: { tone: tone() } }, content: props.blocks }
      ]);
      await editor.close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The edit failed");
    }
  };

  return (
    <Dialog title="Wrap in Note" description="Choose the note's tone." size="small">
      <Stack gap="medium">
        <ToggleGroup value={tone()} options={tones} onChange={setTone} />
        <Show when={error()}>{(message) => <Text tone="danger">{message()}</Text>}</Show>
        <Stack direction="row" gap="small" justify="end">
          <Button onClick={() => editor.close()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={wrap}>
            Wrap
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
};
