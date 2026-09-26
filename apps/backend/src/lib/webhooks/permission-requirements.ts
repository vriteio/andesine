import type { AuthorizationRequirements } from "#backend/lib/policy/permissions";

const webhookReadRequirements = {
  session: ["read:webhooks"],
  key: ["read:webhooks"],
  oauth: ["read:webhooks"]
} satisfies AuthorizationRequirements;
const webhookManageRequirements = {
  session: ["webhooks"],
  key: ["webhooks"],
  oauth: ["webhooks"]
} satisfies AuthorizationRequirements;

export { webhookReadRequirements, webhookManageRequirements };
