import { TaskItem as BaseTaskItem } from "@andesine/document/tiptap";

const TaskItem = BaseTaskItem.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: () => this.editor.commands.sinkListItem(this.name)
    };
  }
});

export { TaskItem };
