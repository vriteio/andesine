import { permissionType } from "#backend/db";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { baseContract } from "./base";

const authContract = baseContract.router({
  session: baseContract
    .route({
      method: "GET",
      path: "/session"
    })
    .meta({
      required: {
        session: true
      }
    })
    .output(
      z.object({
        workspaceID: id(),
        subscriptionPlan: z.string(),
        memberID: id(),
        userID: id(),
        roleID: id(),
        permissions: z.array(permissionType),
        admin: z.boolean()
      })
    ),
  verifyOTPToken: baseContract
    .input(
      z.object({
        token: z.string()
      })
    )
    .output(
      z.object({
        email: z.email(),
        otp: z.string().length(6)
      })
    )
});

export { authContract };
