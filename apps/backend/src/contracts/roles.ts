import { roleNameErrors } from "./errors";
import { permissionType, roleType } from "#backend/db";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";

const rolesContract = baseContract.prefix("/roles").router({
  list: authenticatedContract
    .route({
      summary: "List roles",
      description: "Returns workspace roles and their permissions.",
      tags: ["roles"],
      method: "GET",
      path: "/"
    })
    .meta({ example: {} })
    .meta({ required: { session: true, key: ["read:roles"] } })
    .output(z.array(roleType)),
  create: authenticatedContract
    .errors(roleNameErrors)
    .route({
      summary: "Create a role",
      description:
        "Creates a workspace role. Names are unique without regard to case and must contain 1 to 50 characters after trimming. Requires the Pro plan and permission to delegate the selected permissions.",
      tags: ["roles"],
      method: "POST",
      path: "/"
    })
    .meta({ example: { name: "Editor", permissions: ["content"] } })
    .meta({ required: { session: true, key: ["roles"] } })
    .input(
      z.object({
        name: z.string().trim().min(1).max(50).describe("Name of the role"),
        permissions: z.array(permissionType).describe("Permissions to grant to the role")
      })
    )
    .output(roleType),
  update: authenticatedContract
    .errors(roleNameErrors)
    .route({
      summary: "Update a role",
      description:
        "Changes a role name or permissions. Names are unique without regard to case. Requires the Pro plan and permission to delegate the selected permissions. Built-in roles have additional restrictions.",
      tags: ["roles"],
      method: "PUT",
      path: "/{id}"
    })
    .meta({ example: { id: "rl_example", name: "Content editor" } })
    .meta({ required: { session: true, key: ["roles"] } })
    .input(
      z.object({
        id: id().describe("ID of the role to update"),
        name: z.string().trim().min(1).max(50).optional().describe("New name for the role"),
        permissions: z.array(permissionType).optional().describe("New permissions for the role")
      })
    )
    .output(z.void()),
  delete: authenticatedContract
    .route({
      summary: "Delete a role",
      description:
        "Deletes a custom role and updates its assignments. Built-in roles cannot be deleted. Requires the Pro plan.",
      tags: ["roles"],
      method: "DELETE",
      path: "/{id}"
    })
    .meta({ example: { id: "rl_example" } })
    .meta({ required: { session: true, key: ["roles"] } })
    .input(
      z.object({
        id: id().describe("ID of the role to delete")
      })
    )
    .output(z.void())
});

export { rolesContract };
