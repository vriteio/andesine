import { permissionType, workspaceType } from "#backend/db";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { baseContract, sessionContract } from "./base";

const workspaceSummaryType = workspaceType.pick({
  id: true,
  name: true,
  logo: true
});
const workspaceListItemType = workspaceSummaryType.extend({
  userID: id().describe("ID of the user associated with this workspace membership"),
  currentEntryID: id().optional().describe("ID of the member's latest active entry"),
  permissions: z.array(permissionType).describe("Permissions granted to the current member"),
  admin: z.boolean().describe("Whether the current member has the system admin role"),
  subscriptionPlan: z.string().describe("Effective feature plan identifier"),
  billingEnabled: z.boolean().describe("Whether cloud billing is configured")
});
const workspacesContract = baseContract.router({
  list: baseContract
    .route({
      method: "GET",
      path: "/workspaces",
      summary: "List available workspaces",
      description:
        "Lists workspaces available to the OAuth user, with current role permissions and plan access. Browser sessions can list workspaces across signed-in accounts. Does not require workspace selection and does not count toward API usage.",
      tags: ["workspaces"]
    })
    .meta({
      required: { session: true, oauth: true },
      requireWorkspace: false,
      trackUsage: false
    })
    .output(z.array(workspaceListItemType)),
  create: sessionContract
    .meta({
      requireWorkspace: false
    })
    .input(
      z.object({
        name: z.string().min(1).max(50).describe("Name of the workspace")
      })
    )
    .output(workspaceSummaryType),
  update: sessionContract
    .input(
      z.object({
        name: z.string().min(1).max(50).optional().describe("New name of the workspace")
      })
    )
    .output(z.void()),
  delete: sessionContract.output(
    z.object({
      workspaceID: id().nullable().describe("The user's fallback workspace after deletion")
    })
  ),
  switch: sessionContract
    .meta({
      requireWorkspace: false
    })
    .input(
      z.object({
        workspaceID: id().describe("ID of the workspace to switch to")
      })
    )
    .output(z.void())
});

export { workspacesContract, workspaceListItemType };
