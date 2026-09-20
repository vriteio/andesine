import {
  type RequestHeadersPluginContext,
  type ResponseHeadersPluginContext
} from "@orpc/server/plugins";
import { os } from "@orpc/server";
import type { SessionData } from "#backend/lib/policy";
import type { ORPCMeta } from "#backend/contracts/base";

interface ORPCContext extends RequestHeadersPluginContext, ResponseHeadersPluginContext {}
interface WSORPCContext {
  auth: SessionData;
}

const base = os.$context<ORPCContext>().$meta<ORPCMeta>({});
const wsBase = os.$context<WSORPCContext>().$meta<ORPCMeta>({});

export { base, wsBase };
export type { ORPCContext };
