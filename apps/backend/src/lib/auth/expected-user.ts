import { ORPCError } from "@orpc/server";

// Another tab can switch the active account, so account requests name the account they're for.
const assertExpectedUser = (userID: string, expectedUserID: string): void => {
  if (userID === expectedUserID) return;

  throw new ORPCError("CONFLICT", {
    message: "The signed-in account changed. Reload the page and try again."
  });
};

export { assertExpectedUser };
