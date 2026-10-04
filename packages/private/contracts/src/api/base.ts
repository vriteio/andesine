import { type AuthorizationRequirements } from "../permissions/requirements";
import { oc } from "@orpc/contract";
import { commonErrors } from "./errors";

interface AIUsage {
  kind: "answer" | "semanticSearch";
  /** Gets the validated input. */
  when?(input: never): boolean;
}

interface ORPCMeta {
  example?: Record<string, unknown>;
  requireWorkspace?: boolean;
  requireProPlan?: boolean;
  trackUsage?: false;
  usageTiming?: "generation";
  aiUsage?: AIUsage;
  required?: AuthorizationRequirements;
  /** Publishable keys can call the operation, from their allowed origins. */
  publishable?: boolean;
}

const isPublicAPI = (meta: ORPCMeta): boolean => {
  return Boolean(
    meta.required && meta.required !== true && (meta.required.key || meta.required.oauth)
  );
};

const baseContract = oc.$meta<ORPCMeta>({}).errors(commonErrors);
const authenticatedContract = baseContract.meta({ required: true });
const sessionContract = baseContract.meta({ required: { session: true } });

export { authenticatedContract, baseContract, sessionContract, isPublicAPI };
export type { AIUsage, ORPCMeta };
