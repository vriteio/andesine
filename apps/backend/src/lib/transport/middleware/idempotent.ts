import { os, ORPCError } from "@orpc/server";
import { type ORPCMeta } from "@andesine/contracts/api/base";
import { redis } from "#backend/lib/adapters";
import type { SessionData } from "#backend/lib/policy";
import { createHash } from "node:crypto";
import { type ORPCContext } from "../orpc";

interface IdempotencyContext extends ORPCContext {
  auth: SessionData;
}
interface IdempotencyRecord {
  hash: string;
  output?: unknown;
}

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
// A running request renews its reservation; one that stopped (for example after a crash) frees the key.
const RESERVATION_TTL_SECONDS = 60;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,255}$/;

/**
 * For operations with the `idempotent` meta: a repeated request with the same Idempotency-Key
 * header, principal, and body returns the first result for 24 hours. Failed requests aren't
 * stored, so they can be retried with the same key.
 */
const idempotent = os
  .$context<IdempotencyContext>()
  .$meta<ORPCMeta>({})
  .middleware(async ({ context, next, path, procedure }, input) => {
    const key = context.reqHeaders?.get("idempotency-key");

    if (!procedure["~orpc"].meta.idempotent || !key) return next();

    if (!IDEMPOTENCY_KEY.test(key)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Idempotency-Key must have 1 to 255 visible ASCII characters"
      });
    }

    const { auth } = context;
    const storageKey = `idempotency:${auth.workspaceID}:${auth.id}:${path.join(".")}:${key}`;
    const hash = createHash("sha256")
      .update(JSON.stringify(input ?? null))
      .digest("hex");
    const reserved = await redis.set(storageKey, JSON.stringify({ hash }), {
      NX: true,
      EX: RESERVATION_TTL_SECONDS
    });

    if (!reserved) {
      const stored = await redis.get(storageKey);
      const record = stored ? (JSON.parse(stored) as IdempotencyRecord) : null;

      if (record && record.hash !== hash) {
        throw new ORPCError("IDEMPOTENCY_KEY_REUSED", {
          status: 422,
          message: "This Idempotency-Key was used with a different request",
          data: { hints: ["Use a new Idempotency-Key for each different request."] }
        });
      }

      if (!record || !("output" in record)) {
        context.resHeaders?.set("Retry-After", "1");

        throw new ORPCError("IDEMPOTENCY_KEY_IN_PROGRESS", {
          status: 409,
          message: "A request with this Idempotency-Key is in progress",
          data: { hints: ["Retry after the first request finishes."] }
        });
      }

      context.resHeaders?.set("Idempotent-Replayed", "true");

      return { output: record.output, context: {} };
    }

    const renewal = setInterval(
      () => {
        void redis.expire(storageKey, RESERVATION_TTL_SECONDS, "XX").catch(() => undefined);
      },
      (RESERVATION_TTL_SECONDS * 1000) / 3
    );

    try {
      let result: Awaited<ReturnType<typeof next>>;

      // Stopped before the result is stored, so a renewal can't shorten the result's TTL.
      try {
        result = await next();
      } finally {
        clearInterval(renewal);
      }

      await redis.set(storageKey, JSON.stringify({ hash, output: result.output }), {
        EX: IDEMPOTENCY_TTL_SECONDS
      });

      return result;
    } catch (error) {
      await redis.del(storageKey);
      throw error;
    }
  });

export { idempotent };
