import { id } from "../primitives/id";
import * as z from "zod";

const userType = z.object({
  id: id().describe("ID of the user"),
  name: z.string().max(320).optional().describe("User's full name"),
  email: z.email().max(320).describe("Email address"),
  emailVerified: z.boolean().describe("Whether the user's email is verified"),
  image: z.string().optional().describe("URL of the user's avatar image"),
  createdAt: z.iso.datetime().describe("The creation date of the user record"),
  updatedAt: z.iso.datetime().describe("The date of the last update of the user record"),
  currentWorkspaceID: id().optional().describe("ID of the user's latest active workspace")
});
const userProfileType = userType.pick({
  id: true,
  name: true,
  email: true,
  image: true
});
type User = z.infer<typeof userType>;
type UserProfile = z.infer<typeof userProfileType>;
export { userProfileType, userType };
export type { User, UserProfile };
