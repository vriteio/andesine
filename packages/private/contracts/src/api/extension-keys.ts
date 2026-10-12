import { publicID } from "../primitives/id";
import * as z from "zod";
import { extensionContract } from "./base";
import {
  extensionPublishableKeyFieldsType,
  extensionPublishableKeyType
} from "./schemas/extensions";

/** Part of the extensions contract. */
const extensionKeysContract = {
  listSelfPublishableKeys: extensionContract
    .route({
      summary: "List managed publishable keys",
      description:
        "Lists the publishable keys that the extension manages. Requires the publishable-keys permission.",
      tags: ["extensions"],
      method: "GET",
      path: "/self/publishable-keys"
    })
    .output(z.object({ data: z.array(extensionPublishableKeyType) })),
  createSelfPublishableKey: extensionContract
    .route({
      summary: "Create a managed publishable key",
      description:
        "Creates a publishable key that the extension manages: read:publishing, and ai-answers with answers. Its collections must be readable by the extension. Members see it in API settings and can only delete it. It stops working while the extension is disabled or revoked; losing the permission or read:publishing, or uninstalling, deletes it, and losing ai-answers removes that permission. Up to 10 keys per installation. Requires the publishable-keys permission.",
      tags: ["extensions"],
      method: "POST",
      path: "/self/publishable-keys"
    })
    .input(
      extensionPublishableKeyFieldsType.extend({
        answers: extensionPublishableKeyFieldsType.shape.answers.default(false)
      })
    )
    .output(extensionPublishableKeyType),
  updateSelfPublishableKey: extensionContract
    .route({
      summary: "Update a managed publishable key",
      description:
        "Changes the name, collections, origins, or AI answers of a key that the extension manages. Requires the publishable-keys permission.",
      tags: ["extensions"],
      method: "PATCH",
      path: "/self/publishable-keys/{keyID}"
    })
    .input(extensionPublishableKeyFieldsType.partial().extend({ keyID: publicID("adn") }))
    .output(extensionPublishableKeyType),
  deleteSelfPublishableKey: extensionContract
    .route({
      summary: "Delete a managed publishable key",
      description:
        "Deletes a key that the extension manages, if it exists. Requires the publishable-keys permission.",
      tags: ["extensions"],
      method: "DELETE",
      path: "/self/publishable-keys/{keyID}"
    })
    .input(z.object({ keyID: publicID("adn") }))
    .output(z.object({ deleted: z.boolean() }))
};

export { extensionKeysContract };
