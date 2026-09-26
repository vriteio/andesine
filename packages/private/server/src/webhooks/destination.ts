import { BlockList, isIP } from "node:net";
import { isPublicAddress } from "../security/network-address";
import type { WebhookDestinationConfig } from "./destination-config";

interface WebhookDestination {
  url: URL;
  hostname: string;
  port: number;
  allowsAddress: (address: string) => boolean;
}

const internalAddresses = new BlockList();
const infrastructureAddresses = new BlockList();

for (const [address, prefix] of [
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16]
] as const) {
  internalAddresses.addSubnet(address, prefix, "ipv4");
}

internalAddresses.addSubnet("fc00::", 7, "ipv6");
internalAddresses.addAddress("::1", "ipv6");
infrastructureAddresses.addAddress("168.63.129.16", "ipv4");
infrastructureAddresses.addAddress("100.100.100.200", "ipv4");
infrastructureAddresses.addAddress("fd00:ec2::254", "ipv6");

class WebhookDestinationError extends Error {
  constructor() {
    super("Webhook destination is not allowed by server policy");
    this.name = "WebhookDestinationError";
  }
}

const parseWebhookDestination = (
  source: string,
  config: WebhookDestinationConfig
): WebhookDestination => {
  if (source.length > 2048 || !URL.canParse(source)) throw new WebhookDestinationError();

  const url = new URL(source);
  const exception = config.WEBHOOK_DESTINATION_EXCEPTIONS.find(({ origin }) => {
    return origin === url.origin;
  });
  const permittedHTTP = url.protocol === "http:" && config.WEBHOOK_ALLOW_HTTP && exception;
  const allowed = new BlockList();

  if (
    (url.protocol !== "https:" && !permittedHTTP) ||
    url.username ||
    url.password ||
    source.includes("#")
  ) {
    throw new WebhookDestinationError();
  }

  for (const address of exception?.addresses ?? []) {
    allowed.addAddress(address, isIP(address) === 4 ? "ipv4" : "ipv6");
  }

  const allowsAddress = (address: string): boolean => {
    const family = isIP(address);
    const type = family === 4 ? "ipv4" : "ipv6";

    if (!family || infrastructureAddresses.check(address, type)) return false;
    // An exception pins ALL answers, including public answers, to its exact IP list.
    if (exception && !allowed.check(address, type)) return false;
    if (isPublicAddress(address)) return true;

    // Link-local, multicast, reserved, translation and infrastructure ranges cannot
    // be enabled by an exception. Only ordinary private/loopback addresses can.
    return Boolean(exception && internalAddresses.check(address, type));
  };

  return {
    url,
    hostname: url.hostname.replace(/^\[|\]$/g, ""),
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    allowsAddress
  };
};

export { parseWebhookDestination, WebhookDestinationError };
export type { WebhookDestination };
