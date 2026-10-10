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
  /** Extensions that are disabled or uninstalled can call the operation (their own state). */
  inactiveExtensions?: boolean;
  /** A web operation that the CLI also calls with OAuth; never in the OpenAPI document. */
  cli?: boolean;
}

const isPublicAPI = (meta: ORPCMeta): boolean => {
  return Boolean(
    meta.required &&
    meta.required !== true &&
    (meta.required.key || meta.required.oauth || meta.required.extension)
  );
};

const baseContract = oc.$meta<ORPCMeta>({}).errors(commonErrors);
const authenticatedContract = baseContract.meta({ required: true });
const sessionContract = baseContract.meta({ required: { session: true } });
/** Web operations for the CLI's local extension development; members sign in with OAuth. */
const cliContract = baseContract.meta({ required: { session: true, oauth: true }, cli: true });
/** The extension API: extension JWTs only; the workspace comes from the token. */
const extensionContract = baseContract.meta({
  required: { extension: true },
  requireWorkspace: false
});

export {
  authenticatedContract,
  baseContract,
  sessionContract,
  cliContract,
  extensionContract,
  isPublicAPI
};
export type { AIUsage, ORPCMeta };
