import { createMutation } from "@tanstack/solid-query";
import { query } from "@solidjs/router";
import { client } from "#web/lib/api";
import { useNotify } from "#web/context/notifications";
import { settleBulkAction } from "#web/lib/primitives";

interface RefreshInput {
  refresh(onRevalidated?: () => void): void;
}

const connectedAppsQuery = query(() => client.auth.listConnectedApps(), "connected-apps");

const useRevokeConnectedAppsMutation = (input: RefreshInput) => {
  const notify = useNotify();
  const mutation = createMutation(() => ({
    mutationFn: (variables: { clientIDs: string[] }) => {
      return settleBulkAction(variables.clientIDs, (clientID) => {
        return client.auth.revokeConnectedApp({ clientID });
      });
    },
    onSuccess: (result) => {
      result.failed.forEach(({ error }) => console.error(error));
      input.refresh(() => {
        mutation.reset();

        if (result.successful.length) {
          notify({
            text:
              result.successful.length > 1
                ? `Access revoked for ${result.successful.length} apps`
                : "Access revoked",
            type: "success"
          });
        }

        if (result.failed.length) {
          notify({
            text:
              result.failed.length > 1
                ? `Failed to revoke access for ${result.failed.length} apps`
                : "Failed to revoke access",
            type: "error"
          });
        }
      });
    }
  }));

  return mutation;
};

export { connectedAppsQuery, useRevokeConnectedAppsMutation };
