// SPDX-License-Identifier: Elastic-2.0
import { createHash } from "node:crypto";

const EVENT_NAMESPACE = "fb704cdd-cf20-4e34-bedb-b6fc875b467a";

/** UUIDv5 (RFC 9562) of the name, so retries send the same event ID. */
const toEventUUID = (name: string): string => {
  const hash = createHash("sha1")
    .update(Buffer.from(EVENT_NAMESPACE.replaceAll("-", ""), "hex"))
    .update(name)
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export { toEventUUID };
