import { createAPIContract } from "#backend/contracts";
import { config } from "#backend/lib/config";
import type { ORPCContext } from "#backend/lib/transport/orpc";
import { implement } from "@orpc/server";

const apiContract = createAPIContract({ maxUploadBytes: config.ASSET_MAX_UPLOAD_BYTES });
const api = implement(apiContract).$context<ORPCContext>();

export { api, apiContract };
