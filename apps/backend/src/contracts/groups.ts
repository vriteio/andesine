import { groupType } from "#backend/db";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { baseContract, sessionContract } from "./base";

const groupDetailsType = groupType.extend({
  invitationIDs: z.array(id()).describe("IDs of pending invitations assigned to the group"),
  memberIDs: z.array(id()).describe("IDs of active memberships assigned to the group")
});
const groupsContract = baseContract.prefix("/groups").router({
  list: sessionContract.route({ method: "GET", path: "/" }).output(z.array(groupDetailsType)),
  create: sessionContract
    .route({ method: "POST", path: "/" })
    .input(groupDetailsType.omit({ id: true }))
    .output(groupDetailsType),
  update: sessionContract
    .route({ method: "PATCH", path: "/{id}" })
    .input(groupDetailsType)
    .output(z.void()),
  delete: sessionContract
    .route({ method: "DELETE", path: "/{id}" })
    .input(z.object({ id: groupType.shape.id }))
    .output(z.void())
});

export { groupsContract };
