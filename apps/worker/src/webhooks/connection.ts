import {
  WebhookDestinationError,
  type WebhookDestination
} from "@andesine/server/webhooks/destination";
import { Resolver } from "node:dns/promises";
import { randomInt } from "node:crypto";
import { BlockList, connect, isIP, type Socket } from "node:net";
import { connect as connectTLS, checkServerIdentity } from "node:tls";

const resolveAddresses = async (hostname: string, signal: AbortSignal): Promise<string[]> => {
  signal.throwIfAborted();

  if (isIP(hostname)) return [hostname];

  const resolver = new Resolver({ timeout: 15_000, tries: 1 });
  const cancel = (): void => resolver.cancel();
  const emptyAnswer = (error: NodeJS.ErrnoException): string[] => {
    if (error.code === "ENODATA" || error.code === "ENOTFOUND") return [];
    throw error;
  };

  signal.addEventListener("abort", cancel, { once: true });

  try {
    const [ipv4, ipv6] = await Promise.all([
      resolver.resolve4(hostname).catch(emptyAnswer),
      resolver.resolve6(hostname).catch(emptyAnswer)
    ]);

    signal.throwIfAborted();

    return [...ipv4, ...ipv6];
  } finally {
    signal.removeEventListener("abort", cancel);
    resolver.cancel();
  }
};
const connectWebhookDestination = async (
  destination: WebhookDestination,
  signal: AbortSignal,
  onConnect: () => void
): Promise<Socket> => {
  const addresses = await resolveAddresses(destination.hostname, signal);

  signal.throwIfAborted();

  if (!addresses.length) {
    throw Object.assign(new Error("Webhook hostname has no address"), {
      code: "WEBHOOK_NO_ADDRESS"
    });
  }
  if (addresses.length > 32 || addresses.some((address) => !destination.allowsAddress(address))) {
    throw new WebhookDestinationError();
  }

  // A failed address must not be the fixed first choice on every retry.
  const address = addresses[randomInt(addresses.length)]!;
  const selected = new BlockList();

  onConnect();

  const socket = connect({ host: address, port: destination.port, signal });

  selected.addAddress(address, isIP(address) === 4 ? "ipv4" : "ipv6");

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
      socket.once("close", () => reject(new Error("Webhook connection closed")));
    });
    signal.throwIfAborted();

    const remote = socket.remoteAddress;

    if (
      !remote ||
      socket.remotePort !== destination.port ||
      !selected.check(remote, isIP(remote) === 4 ? "ipv4" : "ipv6") ||
      !destination.allowsAddress(remote)
    ) {
      throw new WebhookDestinationError();
    }

    if (destination.url.protocol === "http:") return socket;

    const secure = connectTLS({
      socket,
      host: destination.hostname,
      servername: isIP(destination.hostname) ? undefined : destination.hostname,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      ALPNProtocols: ["http/1.1"]
    });

    try {
      await new Promise<void>((resolve, reject) => {
        secure.once("secureConnect", resolve);
        secure.once("error", reject);
        secure.once("close", () => reject(new Error("Webhook TLS connection closed")));
      });
      signal.throwIfAborted();

      const identityError = checkServerIdentity(destination.hostname, secure.getPeerCertificate());

      if (!secure.authorized || identityError) throw new Error("Webhook TLS verification failed");

      return secure;
    } catch (error) {
      secure.destroy();
      throw error;
    }
  } catch (error) {
    socket.destroy();
    throw error;
  }
};

export { connectWebhookDestination };
