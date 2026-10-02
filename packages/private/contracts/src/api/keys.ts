import { keyKindType, keyOriginType, keyPermissionType, keyType } from "../entities/keys";
import { id, publicID } from "../primitives/id";
import * as z from "zod";
import { baseContract, sessionContract } from "./base";

const keyWithRawKeyType = keyType.extend({
  rawKey: z.string().describe("The full raw API key value")
});
// Publishable keys need them; the service checks the rules for each kind.
const publishableFields = {
  collectionIDs: z
    .array(publicID("coll"))
    .max(50)
    .optional()
    .describe(
      "Publishable keys: collections, with their descendants, that the key can read; none for all"
    ),
  allowedOrigins: z
    .array(keyOriginType)
    .max(20)
    .optional()
    .describe("Publishable keys: browser origins that can use the key, with localhost")
};
const keysContract = baseContract.prefix("/keys").router({
  create: sessionContract
    .input(
      z.object({
        name: z.string().min(1).max(100).describe("Name for the API key"),
        kind: keyKindType.default("secret").describe("Kind of the API key; it cannot change"),
        permissions: z.array(keyPermissionType).describe("Permissions to grant to the API key"),
        ...publishableFields
      })
    )
    .output(keyWithRawKeyType),
  get: sessionContract
    .input(
      z.object({
        id: id().describe("ID of the API key to retrieve")
      })
    )
    .output(keyType),
  list: sessionContract.output(z.array(keyType)),
  delete: sessionContract
    .input(
      z.object({
        ids: z.array(id()).describe("IDs of the API keys to delete")
      })
    )
    .output(z.void()),
  update: sessionContract
    .input(
      z.object({
        id: id().describe("ID of the API key to update"),
        name: z.string().min(1).max(100).optional().describe("New name for the API key"),
        permissions: z
          .array(keyPermissionType)
          .optional()
          .describe("New permissions for the API key"),
        ...publishableFields
      })
    )
    .output(z.void()),
  rotate: sessionContract
    .input(
      z.object({
        id: id().describe("ID of the API key to rotate"),
        expiresIn: z.enum(["now", "1h", "24h", "7d"]).describe("When the old key should expire")
      })
    )
    .output(keyWithRawKeyType)
});

export { keysContract };
