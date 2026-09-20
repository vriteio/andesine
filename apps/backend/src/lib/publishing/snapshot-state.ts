import { publishingChannels, publishingSnapshots } from "#backend/db";
import type { db } from "#backend/lib/adapters";
import { getEffectivePlan } from "#backend/lib/billing";
import { config } from "#backend/lib/config";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { normalizePublishingChannelCode } from "./channel";

interface CreateInitialPublishingChannelInput {
  builtIn?: boolean;
  code: string;
  creatorID?: string;
  name: string;
  workspaceID: string;
}
interface ResolvedPublishingSnapshot {
  channelCode: string;
  channelID: string;
  createdAt: Date;
  creatorID: string | null;
  expiresAt: Date | null;
  id: string;
  isCurrent: boolean;
  reason: "channel-deletion" | "initial" | "publish" | "unpublish";
  supersededAt: Date | null;
  workspaceID: string;
}
interface ResolveCurrentPublishingSnapshotInput {
  channelCode: string;
  snapshotID?: never;
}
interface ResolvePublishingSnapshotByIDInput {
  channelCode?: never;
  snapshotID: string;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DatabaseClient = DatabaseTransaction | typeof db;
type ResolvePublishingSnapshotInput =
  ResolveCurrentPublishingSnapshotInput | ResolvePublishingSnapshotByIDInput;

const createInitialPublishingChannel = async (
  database: DatabaseTransaction,
  input: CreateInitialPublishingChannelInput
) => {
  const now = new Date();
  const [channel] = await database
    .insert(publishingChannels)
    .values({
      workspaceID: input.workspaceID,
      code: input.code,
      name: input.name,
      builtIn: input.builtIn
    })
    .onConflictDoNothing()
    .returning();

  if (!channel) return null;

  const [snapshot] = await database
    .insert(publishingSnapshots)
    .values({
      workspaceID: input.workspaceID,
      channelID: channel.id,
      creatorID: input.creatorID ? toUUID(input.creatorID) : null,
      reason: "initial"
    })
    .returning();

  await database
    .update(publishingChannels)
    .set({ currentSnapshotID: snapshot.id, updatedAt: now })
    .where(eq(publishingChannels.id, channel.id));

  return { ...channel, currentSnapshotID: snapshot.id, updatedAt: now };
};
const getPublishingSnapshotExpiry = (subscriptionPlan: string, from: Date): Date => {
  const retentionDays =
    getEffectivePlan(subscriptionPlan) === "pro"
      ? config.PRO_VERSION_RETENTION_DAYS
      : config.VERSION_RETENTION_DAYS;

  return new Date(from.getTime() + retentionDays * 24 * 60 * 60 * 1000);
};
const resolvePublishingSnapshot = async (
  database: DatabaseClient,
  workspaceID: string,
  input: ResolvePublishingSnapshotInput
): Promise<ResolvedPublishingSnapshot> => {
  const now = new Date();
  const code = input.channelCode ? normalizePublishingChannelCode(input.channelCode) : undefined;
  const snapshotID = input.snapshotID ? toUUID(input.snapshotID) : undefined;
  const filters = snapshotID
    ? [
        eq(publishingSnapshots.workspaceID, workspaceID),
        eq(publishingSnapshots.id, snapshotID),
        or(isNull(publishingSnapshots.expiresAt), gt(publishingSnapshots.expiresAt, now))!
      ]
    : [
        eq(publishingChannels.workspaceID, workspaceID),
        eq(publishingChannels.code, code!),
        isNull(publishingChannels.deletedAt),
        eq(publishingSnapshots.id, publishingChannels.currentSnapshotID),
        isNull(publishingSnapshots.supersededAt),
        isNull(publishingSnapshots.expiresAt)
      ];
  const [resolved] = await database
    .select({
      snapshot: publishingSnapshots,
      channelCode: publishingChannels.code,
      currentSnapshotID: publishingChannels.currentSnapshotID
    })
    .from(publishingSnapshots)
    .innerJoin(
      publishingChannels,
      and(
        eq(publishingChannels.workspaceID, publishingSnapshots.workspaceID),
        eq(publishingChannels.id, publishingSnapshots.channelID)
      )
    )
    .where(and(...filters))
    .for("key share", { of: publishingSnapshots });

  if (!resolved) {
    throw new ORPCError("NOT_FOUND", {
      message: "Publishing snapshot not found or unavailable",
      data: {
        hints: [
          "Check the channel or snapshot ID. If a pinned snapshot is unavailable, read from the channel again and use the new snapshot ID for all related reads."
        ]
      }
    });
  }

  return {
    ...resolved.snapshot,
    channelCode: resolved.channelCode,
    isCurrent: resolved.currentSnapshotID === resolved.snapshot.id
  };
};

export { createInitialPublishingChannel, getPublishingSnapshotExpiry, resolvePublishingSnapshot };
export type {
  CreateInitialPublishingChannelInput,
  ResolvedPublishingSnapshot,
  ResolvePublishingSnapshotInput
};
