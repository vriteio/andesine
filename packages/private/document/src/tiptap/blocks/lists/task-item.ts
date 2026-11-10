import { TaskItem as BaseTaskItem } from "@tiptap/extension-task-item";

const TaskItem = BaseTaskItem.extend({
  content: "paragraph block*"
});

export { TaskItem };
