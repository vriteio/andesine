import { createMutation } from "@tanstack/solid-query";
import { type Component } from "solid-js";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import { useNotify } from "#web/context/notifications";
import { client } from "#web/lib/api";
import { getWebhookErrorCode, type Webhook } from "#web/lib/data";
import { getWebhookHost } from "../../webhook/configuration";

interface DeleteWebhookDialogProps {
  webhooks: Array<Pick<Webhook, "id" | "name" | "revision" | "url">>;
  onClose(): void;
  onDeleted(): void;
  onConflict(): void;
}

const DeleteWebhookDialog: Component<DeleteWebhookDialogProps> = (props) => {
  const notify = useNotify();
  const deleteMutation = createMutation(() => ({
    retry: false,
    mutationFn: (webhooks: DeleteWebhookDialogProps["webhooks"]) => {
      return client.webhooks.bulkDelete({
        webhooks: webhooks.map(({ id, revision }) => ({ id, expectedRevision: revision }))
      });
    },
    onSuccess: (_, webhooks) => {
      notify({
        type: "success",
        text: webhooks.length === 1 ? "Webhook deleted" : `${webhooks.length} webhooks deleted`
      });
      props.onDeleted();
    },
    onError: (error) => {
      const code = getWebhookErrorCode(error);

      console.error(error);

      if (code === "CONFLICT" || code === "NOT_FOUND") {
        notify({ type: "error", text: "A webhook changed. Try again after the list updates" });
        props.onConflict();

        return;
      }

      notify({
        type: "error",
        text: "Failed to delete. Reload to check whether the webhooks were deleted"
      });
    },
    onSettled: () => {
      deleteMutation.reset();
    }
  }));

  const multiple = () => props.webhooks.length > 1;

  return (
    <ActionConfirmationDialog
      opened={props.webhooks.length > 0}
      title={multiple() ? `Delete ${props.webhooks.length} webhooks?` : "Delete webhook?"}
      description="Sending stops and pending events are cancelled. Historical data remains accessible until its expiration."
      affected={props.webhooks.map((webhook) => ({
        id: webhook.id,
        icon: "i-lucide:webhook",
        label: webhook.name,
        detail: getWebhookHost(webhook.url)
      }))}
      action={{
        color: "danger",
        label: multiple() ? "Delete webhooks" : "Delete webhook",
        loading: deleteMutation.isPending,
        onClick: () => deleteMutation.mutate(props.webhooks)
      }}
      onClose={() => {
        if (!deleteMutation.isPending) props.onClose();
      }}
    />
  );
};

export { DeleteWebhookDialog };
