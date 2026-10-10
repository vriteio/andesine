import { type ExtensionWebhookState } from "@andesine/contracts/extensions";
import { toUUID } from "@andesine/contracts/primitives";
import { extensions, webhookEndpoints } from "@andesine/server/database";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import { describeWebhookEndpoints } from "@andesine/server/webhooks/recording";
import { isVisibleExtension } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";

interface ListWebhooksInput {
  extensionID: string;
}

const listWebhooks = withAuthorization<ListWebhooksInput, undefined, ExtensionWebhookState[]>(
  { permissions: { session: true }, transaction: "snapshot" },
  async ({ auth, database, input, workspaceID }) => {
    const [extension] = await database
      .select({ id: extensions.id })
      .from(extensions)
      .where(
        and(
          eq(extensions.id, toUUID(input.extensionID)),
          eq(extensions.workspaceID, workspaceID),
          isNull(extensions.uninstalledAt),
          isVisibleExtension(auth)
        )
      );

    if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

    const rows = await database
      .select()
      .from(webhookEndpoints)
      .where(
        and(eq(webhookEndpoints.extensionID, extension.id), isNull(webhookEndpoints.deletedAt))
      )
      .orderBy(asc(webhookEndpoints.extensionWebhookID));
    const described = await describeWebhookEndpoints(
      database,
      rows,
      await getDeliveryTime(database)
    );

    return rows.map((row, index) => ({
      webhookID: row.extensionWebhookID!,
      url: row.url,
      eventTypes: row.eventTypes,
      enabled: row.enabled,
      disabledReason: row.disabledReason,
      health: described[index]!.health
    }));
  }
);

export { listWebhooks };
