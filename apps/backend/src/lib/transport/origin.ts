import { timingSafeEqual } from "node:crypto";
import { config } from "#backend/lib/config";

const ORIGIN_SECRET_HEADER = "x-origin-secret";

/** Whether the request has the proxy's origin secret; always true without ORIGIN_SECRET. */
const hasOriginSecret = (headers: Record<string, string | string[] | undefined>): boolean => {
  if (!config.ORIGIN_SECRET) return true;

  const expected = Buffer.from(config.ORIGIN_SECRET);
  const received = Buffer.from(String(headers[ORIGIN_SECRET_HEADER] ?? ""));

  return expected.length === received.length && timingSafeEqual(expected, received);
};

export { hasOriginSecret, ORIGIN_SECRET_HEADER };
