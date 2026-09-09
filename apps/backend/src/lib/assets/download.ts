import { ORPCError } from "@orpc/server";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { checkServerIdentity } from "node:tls";
import type { IncomingMessage } from "node:http";

const blockedAddresses = new BlockList();
const publicIPv6 = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3]
] as const)
  blockedAddresses.addSubnet(address, prefix, "ipv4");
publicIPv6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20]
] as const)
  blockedAddresses.addSubnet(address, prefix, "ipv6");

const isPublicAddress = (address: string): boolean => {
  const family = isIP(address);

  if (family === 4) return !blockedAddresses.check(address, "ipv4");
  return (
    family === 6 && publicIPv6.check(address, "ipv6") && !blockedAddresses.check(address, "ipv6")
  );
};
const readResponse = async (url: URL, signal: AbortSignal): Promise<IncomingMessage> => {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });

  signal.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address)))
    throw new Error("Non-public address");

  return new Promise((resolve, reject) => {
    // Connect to the checked address, without a second DNS lookup. Keep TLS and Host
    // validation tied to the original hostname, including on every redirect.
    const download = request(
      {
        hostname: addresses[0].address,
        port: 443,
        servername: isIP(hostname) ? undefined : hostname,
        checkServerIdentity: (_hostname, certificate) => checkServerIdentity(hostname, certificate),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent: false,
        signal,
        maxHeaderSize: 16 * 1024,
        headers: {
          "Host": url.host,
          "Accept": "image/jpeg,image/png,image/webp",
          "Accept-Encoding": "identity"
        }
      },
      resolve
    );

    download.on("error", reject);
    download.end();
  });
};
const downloadImage = async (source: string, maxBytes: number) => {
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), 30_000);
  const aborted = new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const download = async () => {
    let url = new URL(source);

    for (let redirects = 0; redirects <= 3; redirects++) {
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443")
      )
        throw new Error("Unsupported URL");

      const response = await readResponse(url, signal);

      try {
        if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
          if (!response.headers.location) throw new Error("Missing redirect URL");
          url = new URL(response.headers.location, url);
          continue;
        }
        if (response.statusCode !== 200) throw new Error("Download failed");
        if (
          response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity"
        )
          throw new Error("Encoded response");

        const contentType = response.headers["content-type"]?.split(";")[0].trim().toLowerCase();
        const length = Number(response.headers["content-length"]);
        const chunks: Buffer[] = [];
        let byteSize = 0;

        if (
          !contentType ||
          !["image/jpeg", "image/png", "image/webp", "application/octet-stream"].includes(
            contentType
          )
        )
          throw new Error("Unsupported image type");
        if (length > maxBytes) throw new Error("Image too large");

        for await (const chunk of response) {
          byteSize += chunk.length;
          if (byteSize > maxBytes) throw new Error("Image too large");
          chunks.push(chunk);
        }
        if (!byteSize) throw new Error("Empty image");

        return { body: Buffer.concat(chunks, byteSize), filename: "Imported image" };
      } finally {
        response.destroy();
      }
    }
    throw new Error("Too many redirects");
  };

  try {
    return await Promise.race([download(), aborted]);
  } catch {
    // Do not expose DNS, internal network, or signed source URL details to clients/logs.
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Could not import this image. Use a public HTTPS URL for a JPEG, PNG, or WebP within the upload size limit."
    });
  } finally {
    clearTimeout(timer);
  }
};

export { downloadImage };
