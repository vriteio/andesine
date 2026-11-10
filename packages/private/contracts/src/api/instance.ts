import { authenticatedContract, baseContract } from "./base";
import { instanceInfoType } from "./schemas/instance";

const instanceContract = baseContract.prefix("/instance").router({
  get: authenticatedContract
    .route({
      method: "GET",
      path: "/",
      tags: ["instance"],
      summary: "Get instance capabilities and limits",
      description:
        "Returns configured features and effective limits for the authenticated workspace. These values do not grant permissions or report live service health. No discovery request is made automatically by the SDK."
    })
    .meta({ required: { session: true, key: true }, trackUsage: false, example: {} })
    .output(instanceInfoType)
});

export { instanceContract };
