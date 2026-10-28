import { config } from "#backend/lib/config";
import { SkipFurtherHooksError } from "@hocuspocus/common";
import { Redis as RedisExtension } from "@hocuspocus/extension-redis";
import type { onStoreDocumentPayload } from "@hocuspocus/server";

const COLLABORATION_REDIS_PREFIX = "andesine:collaboration";
const MAX_STORE_RETRIES = 5;

class CollaborationRedisExtension extends RedisExtension {
  private storeRetries = new Map<string, number>();

  constructor(configuration: ConstructorParameters<typeof RedisExtension>[0]) {
    super(configuration);

    this.pub.on("error", (error) => {
      console.error("Collaboration Redis publisher error", { error });
    });
    this.sub.on("error", (error) => {
      console.error("Collaboration Redis subscriber error", { error });
    });
  }

  /**
   * Whether any instance has the document open, from the subscribers of its channel. Mirrors the
   * private `hasOtherSubscribers` and channel key of the extension (4.4.0), counting this instance.
   */
  async isDocumentOpen(documentName: string): Promise<boolean> {
    try {
      const result = await this.pub.pubsub(
        "NUMSUB",
        `${COLLABORATION_REDIS_PREFIX}:${documentName}`
      );

      return Number((result as unknown[])[1] ?? 0) > 0;
    } catch {
      return true;
    }
  }

  // With connections left, their next change saves again. Without them, the document unloads,
  // so save again later: the lock holder may not have this instance's last updates.
  async onStoreDocument(payload: onStoreDocumentPayload): Promise<void> {
    try {
      await super.onStoreDocument(payload);
      this.storeRetries.delete(payload.documentName);
    } catch (error) {
      const retries = (this.storeRetries.get(payload.documentName) ?? 0) + 1;
      const unloading = payload.document.getConnectionsCount() === 0;
      const retryable =
        error instanceof SkipFurtherHooksError && unloading && retries <= MAX_STORE_RETRIES;

      if (retryable) {
        this.storeRetries.set(payload.documentName, retries);
        void payload.instance.storeDocumentHooks(payload.document, payload);
      } else {
        this.storeRetries.delete(payload.documentName);
      }

      throw error;
    }
  }

  async afterLoadDocument(...args: Parameters<RedisExtension["afterLoadDocument"]>): Promise<void> {
    try {
      await super.afterLoadDocument(...args);
    } catch (error) {
      console.error("Collaboration Redis initialization failed", { error });
      throw error;
    }
  }
}

const collaborationRedisURL = new URL(config.REDIS_URL);
const collaborationRedisDatabase = Number(collaborationRedisURL.pathname.slice(1) || "0");
const collaborationRedis = new CollaborationRedisExtension({
  host: collaborationRedisURL.hostname,
  port: Number(collaborationRedisURL.port || "6379"),
  prefix: COLLABORATION_REDIS_PREFIX,
  // A save can wait for the workspace row lock; with the 1 s default, two instances save at once.
  lockTimeout: 10_000,
  options: {
    db: collaborationRedisDatabase,
    ...(collaborationRedisURL.username && {
      username: decodeURIComponent(collaborationRedisURL.username)
    }),
    ...(collaborationRedisURL.password && {
      password: decodeURIComponent(collaborationRedisURL.password)
    }),
    ...(collaborationRedisURL.protocol === "rediss:" && { tls: {} })
  }
});

export { COLLABORATION_REDIS_PREFIX, collaborationRedis };
