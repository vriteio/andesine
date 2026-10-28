import { Memberships } from "#backend/services/memberships";

interface SoleAdminWorkspace {
  id: string;
  name: string;
}

const listSoleAdminWorkspaces = async (input: {
  userID: string;
}): Promise<SoleAdminWorkspace[]> => {
  const userMemberships = await Memberships.listForUser(input);

  return userMemberships
    .filter(({ soleAdmin }) => soleAdmin)
    .map(({ workspaceID, workspaceName }) => ({ id: workspaceID, name: workspaceName }));
};

export { listSoleAdminWorkspaces };
