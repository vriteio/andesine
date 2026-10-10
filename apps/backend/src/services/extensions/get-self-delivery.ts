import { type ExtensionDelivery } from "@andesine/contracts/extensions";
import { toUUID } from "@andesine/contracts/primitives";
import {
  outboundDeliveries,
  outboundDeliveryRuns,
  webhookEndpoints
} from "@andesine/server/database";
import { getDeliveryAccessStopReason, getDeliveryTime } from "@andesine/server/webhooks/delivery";
import { loadStoredWebhookEvent } from "@andesine/server/webhooks/recording";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gt } from "drizzle-orm";

interface GetSelfDeliveryInput {
  deliveryID: string;
}

/** Content events need the extension's current access, as for sending; lifecycle ones do not. */
const getSelfDelivery = withAuthorization<GetSelfDeliveryInput, undefined, ExtensionDelivery>(
  { permissions: { extension: true }, transaction: "snapshot" },
  async ({ auth, database, input }) => {
    const notFound = new ORPCError("NOT_FOUND", { message: "Delivery not found" });
    const now = await getDeliveryTime(database);
    const [row] = await database
      .select({ delivery: outboundDeliveries, endpoint: webhookEndpoints })
      .from(outboundDeliveries)
      .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, outboundDeliveries.endpointID))
      .where(
        and(
          eq(outboundDeliveries.id, toUUID(input.deliveryID)),
          eq(webhookEndpoints.extensionID, toUUID(auth.extension!.extensionID)),
          gt(outboundDeliveries.expiresAt, now)
        )
      );

    if (!row) throw notFound;

    const event = await loadStoredWebhookEvent(database, row.delivery);

    if (event.subject.kind !== "extension") {
      const [run] = await database
        .select()
        .from(outboundDeliveryRuns)
        .where(eq(outboundDeliveryRuns.deliveryID, row.delivery.id))
        .orderBy(desc(outboundDeliveryRuns.number))
        .limit(1);
      const reason =
        run &&
        (await getDeliveryAccessStopReason(database, {
          ...row,
          run,
          workspaceDeleting: false
        }));

      if (!run || reason) throw notFound;
    }

    return { deliveryID: input.deliveryID, event };
  }
);

export { getSelfDelivery };
