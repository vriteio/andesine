import { auth } from "#backend/lib/adapters";
import { toUUID } from "@andesine/contracts/primitives";

// Deletes the user with their sessions and accounts; memberships cascade.
const deleteUser = async (input: { userID: string }): Promise<void> => {
  const { internalAdapter } = await auth.$context;

  await internalAdapter.deleteUser(toUUID(input.userID));
};

export { deleteUser };
