import { id } from "../primitives/id";
import * as z from "zod";

const membershipType = z.object({
  id: id().describe("ID of the membership"),
  userID: id().describe("ID of the user"),
  roleID: id().describe("ID of the role")
});
type Membership = z.infer<typeof membershipType>;
export { membershipType };
export type { Membership };
