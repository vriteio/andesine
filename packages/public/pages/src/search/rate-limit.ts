interface RateLimitOptions {
  /** Requests allowed in each window. */
  limit: number;
  /** Window length, in milliseconds. */
  window: number;
}

/**
 * A small in-memory rate limit per client, e.g. by IP address. Each server instance counts on its
 * own, so it only limits abuse; the Andesine API applies its own limits too.
 */
const createRateLimit = (options: RateLimitOptions): ((client: string) => boolean) => {
  const requests = new Map<string, number[]>();

  let prunedAt = 0;

  return (client) => {
    const now = Date.now();
    const recent = (requests.get(client) ?? []).filter((time) => now - time < options.window);
    const shouldPrune = requests.size > 10_000 && now - prunedAt >= options.window;

    // Forgets clients without recent requests, at most once a window, so memory stays small.
    if (shouldPrune) {
      prunedAt = now;

      for (const [key, times] of requests) {
        if (times.every((time) => now - time >= options.window)) requests.delete(key);
      }
    }

    if (recent.length >= options.limit) {
      requests.set(client, recent);

      return false;
    }

    requests.set(client, [...recent, now]);

    return true;
  };
};

export { createRateLimit };
export type { RateLimitOptions };
