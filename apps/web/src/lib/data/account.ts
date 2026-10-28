import { query } from "@solidjs/router";
import { client } from "#web/lib/api";

const soleAdminWorkspacesQuery = query(
  (userID: string) => client.auth.listSoleAdminWorkspaces({ userID }),
  "sole-admin-workspaces"
);

export { soleAdminWorkspacesQuery };
