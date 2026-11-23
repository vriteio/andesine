import clsx from "clsx";
import { Editor, Extension, Node } from "@tiptap/core";
import { history, redo, undo } from "@tiptap/pm/history";
import { type Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { IconButton, Shortcut, Tooltip } from "@andesine/components";
import { Code, HardBreak, Link, Paragraph, Text } from "@andesine/document/tiptap";
import { Bold } from "#editor/extensions/marks/bold";
import { Italic } from "#editor/extensions/marks/italic";
import { Strike } from "#editor/extensions/marks/strike";
import { MARK_CLASSES } from "./comment-text";
import { parseComment, serializeComment } from "./markdown";

const CommentDocument = Node.create({ name: "doc", topNode: true, content: "paragraph" });
// Before the core keymap, which would split the paragraph on Enter.
const CommentKeys = Extension.create<{
  submit(): void;
  cancel(): boolean;
  step(step: number): boolean;
}>({
  name: "commentKeys",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        this.options.submit();
        return true;
      },
      Escape: () => this.options.cancel(),
      ArrowLeft: () => this.editor.isEmpty && this.options.step(-1),
      ArrowRight: () => this.editor.isEmpty && this.options.step(1)
    };
  }
});

const CommentHistory = Extension.create({
  name: "commentHistory",
  addProseMirrorPlugins() {
    return [history()];
  },
  addKeyboardShortcuts() {
    const run = (command: typeof undo) => command(this.editor.state, this.editor.view.dispatch);

    return { "Mod-z": () => run(undo), "Mod-Shift-z": () => run(redo), "Mod-y": () => run(redo) };
  }
});

interface CommentEditorProps {
  placeholder: string;
  gray?: boolean;
  onPanel?: boolean;
  /** Also focuses the field. */
  value?: string;
  autofocus?: boolean;
  /** Without it, Escape only blurs the field. */
  onCancel?(): void;
  onStep?(step: number): void;
  /** A rejection keeps the text. */
  onSubmit(content: string): Promise<unknown>;
}

const CommentEditor: Component<CommentEditorProps> = (props) => {
  const [editor, setEditor] = createSignal<Editor | null>(null);
  const [empty, setEmpty] = createSignal(!props.value);
  const [submitting, setSubmitting] = createSignal(false);

  let element: HTMLDivElement | undefined;

  const submit = async () => {
    const instance = editor();
    const content = instance ? serializeComment(instance.getJSON()) : "";

    if (!instance || !content || submitting()) return;

    setSubmitting(true);
    instance.setEditable(false);

    try {
      await props.onSubmit(content);
      instance.commands.clearContent(true);
    } catch {
      // Keeps the text for another try.
    } finally {
      setSubmitting(false);
      instance.setEditable(true);
      instance.commands.focus();
    }
  };

  onMount(() => {
    const instance = new Editor({
      element,
      content: parseComment(props.value ?? ""),
      extensions: [
        CommentDocument,
        Paragraph,
        Text,
        HardBreak,
        CommentHistory,
        Bold.configure({ HTMLAttributes: { class: MARK_CLASSES.bold } }),
        Italic.configure({ HTMLAttributes: { class: MARK_CLASSES.italic } }),
        Strike.configure({ HTMLAttributes: { class: MARK_CLASSES.strike } }),
        Code.configure({ HTMLAttributes: { class: MARK_CLASSES.code } }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: MARK_CLASSES.link }
        }),
        CommentKeys.configure({
          submit: () => {
            void submit();
          },
          cancel: () => {
            if (props.onCancel) props.onCancel();
            else instance.commands.blur();

            return true;
          },
          step: (step) => {
            if (!props.onStep) return false;

            props.onStep(step);

            return true;
          }
        })
      ],
      editorProps: {
        attributes: { class: "outline-none text-sm text-gray-700 break-words" },
        // Keeps keys from the menus around it.
        handleKeyDown: (_, event) => {
          event.stopPropagation();
          return false;
        }
      },
      onUpdate: ({ editor: current }) => setEmpty(current.isEmpty)
    });

    setEditor(instance);

    if (props.value !== undefined || props.autofocus) instance.commands.focus("end");

    onCleanup(() => instance.destroy());
  });

  return (
    <div
      class={clsx(
        "flex items-end gap-1 rounded-lg outline outline-1 -outline-offset-1 outline-gray-200 shadow-md shadow-gray-900/8 p-0.5 pl-2",
        props.gray ? "bg-gray-50" : "bg-white",
        props.onPanel ? "focus-within:bg-gray-50" : "focus-within:bg-gray-100"
      )}
    >
      <div class="relative min-w-0 flex-1 max-h-48 overflow-y-auto py-0.5">
        <Show when={empty()}>
          <span class="pointer-events-none absolute top-0.5 left-0 text-sm text-gray-400">
            {props.placeholder}
          </span>
        </Show>
        <div ref={element} />
      </div>
      <Tooltip
        content={
          <div class="flex flex-col items-center justify-center gap-0.5">
            <span>Send</span>
            <Shortcut class="opacity-50 font-mono text-[80%]" shortcut="Enter" />
          </div>
        }
        placement="bottom"
        fixed
      >
        <IconButton
          // Darker than the focused field.
          class="p-0.75 rounded-md @hover:bg-gray-200"
          icon="i-lucide:arrow-up"
          variant="ghost"
          text="base"
          size="xs"
          aria-label="Send"
          loading={submitting()}
          disabled={empty()}
          onClick={() => submit()}
        />
      </Tooltip>
    </div>
  );
};

export { CommentEditor };
