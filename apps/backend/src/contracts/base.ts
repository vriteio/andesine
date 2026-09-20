import type { AuthorizationRequirements } from "#backend/lib/policy/permissions";
import { oc } from "@orpc/contract";
import { commonErrors } from "./errors";

interface ORPCMeta {
  example?: Record<string, unknown>;
  requireWorkspace?: boolean;
  requireProPlan?: boolean;
  trackUsage?: boolean;
  usageTiming?: "generation";
  required?: AuthorizationRequirements;
}

const baseContract = oc.$meta<ORPCMeta>({}).errors(commonErrors);
const authenticatedContract = baseContract.meta({ required: true });
const sessionContract = baseContract.meta({ required: { session: true } });

export { authenticatedContract, baseContract, sessionContract };
export type { ORPCMeta };
