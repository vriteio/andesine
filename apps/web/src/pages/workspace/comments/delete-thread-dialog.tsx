import type { Component } from "solid-js";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import type { CommentThread } from "#web/lib/data/comments";

interface DeleteThreadDialogProps {
  thread: CommentThread | null;
  loading: boolean;
  onClose(): void;
  onConfirm(): void;
}

const DeleteThreadDialog: Component<DeleteThreadDialogProps> = (props) => {
  const affected = () => {
    const { thread } = props;
    const count = thread?.comments.length ?? 0;

    if (!thread) return [];

    return [
      {
        id: thread.id,
        icon: "i-tabler:message",
        label: thread.quote ? `“${thread.quote}”` : "Block comment",
        detail: count === 1 ? "1 comment" : `${count} comments`
      }
    ];
  };

  return (
    <ActionConfirmationDialog
      opened={Boolean(props.thread)}
      title="Delete thread?"
      description="Deleting the first comment deletes the thread with all its comments."
      affected={affected()}
      action={{
        color: "danger",
        label: "Delete thread",
        loading: props.loading,
        onClick: props.onConfirm
      }}
      onClose={props.onClose}
    />
  );
};

export { DeleteThreadDialog };
