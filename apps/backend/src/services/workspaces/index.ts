import { beginWorkspaceDeletion } from "./begin-deletion";
import { cancelWorkspaceDeletion } from "./cancel-deletion";
import { listWorkspaces } from "./list";
import { listSoleAdminWorkspaces } from "./list-sole-admin";
import { createWorkspace } from "./create";
import { updateWorkspace } from "./update";
import { deleteWorkspace } from "./delete";
import { destroyWorkspace } from "./destroy";
import { switchWorkspace } from "./switch";

const Workspaces = {
  beginDeletion: beginWorkspaceDeletion,
  cancelDeletion: cancelWorkspaceDeletion,
  list: listWorkspaces,
  listSoleAdmin: listSoleAdminWorkspaces,
  create: createWorkspace,
  update: updateWorkspace,
  delete: deleteWorkspace,
  destroy: destroyWorkspace,
  switch: switchWorkspace
};

export { Workspaces };
