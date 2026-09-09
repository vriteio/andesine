import { config } from "#backend/lib/config";
import { ORPCError } from "@orpc/server";
import { createAssetStorage } from "./storage";

const assetStorage = createAssetStorage(config);
const requireAssetStorage = () => {
  if (!assetStorage) {
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Image storage is not configured" });
  }
  return assetStorage;
};

export { requireAssetStorage };
