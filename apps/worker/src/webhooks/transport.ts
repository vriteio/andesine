import { type WebhookDestination } from "@andesine/server/webhooks/destination";
import { type WebhookSignatureHeaders } from "@andesine/server/webhooks/signing";
import { Agent as HTTPAgent, request as requestHTTP } from "node:http";
import { Agent as HTTPSAgent, request as requestHTTPS } from "node:https";
import { connectWebhookDestination } from "./connection";

interface WebhookHTTPResponse {
  status: number;
  retryAfter: string | null;
}
interface SendWebhookRequestInput {
  destination: WebhookDestination;
  payload: Buffer;
  signal: AbortSignal;
  onConnect: () => void;
  prepareHeaders: () => Promise<WebhookSignatureHeaders>;
}

const sendWebhookRequest = async (input: SendWebhookRequestInput): Promise<WebhookHTTPResponse> => {
  const { destination, payload, signal } = input;
  const socket = await connectWebhookDestination(destination, signal, input.onConnect);
  const secure = destination.url.protocol === "https:";
  const agent = secure
    ? new HTTPSAgent({ keepAlive: false, proxyEnv: {} })
    : new HTTPAgent({ keepAlive: false, proxyEnv: {} });
  const request = secure ? requestHTTPS : requestHTTP;

  // The only socket this one-request agent can use has already passed IP and TLS checks.
  agent.createConnection = () => socket;

  try {
    const headers = await input.prepareHeaders();

    signal.throwIfAborted();
    if (socket.destroyed) throw new Error("Webhook connection closed before dispatch");

    return await new Promise<WebhookHTTPResponse>((resolve, reject) => {
      const outgoing = request({
        protocol: destination.url.protocol,
        hostname: destination.hostname,
        port: destination.port,
        path: `${destination.url.pathname}${destination.url.search}`,
        method: "POST",
        agent,
        signal,
        maxHeaderSize: 16 * 1024,
        insecureHTTPParser: false,
        headers: {
          ...headers,
          "host": destination.url.host,
          "content-length": payload.byteLength,
          "accept-encoding": "identity",
          "connection": "close"
        }
      });

      outgoing.maxHeadersCount = 100;
      outgoing.once("error", reject);
      outgoing.once("close", () => reject(new Error("Webhook response unavailable")));
      outgoing.once("response", (response) => {
        // Acceptance is determined by the final status headers. Do not read,
        // decompress, retain, or wait for an arbitrary receiver response body.
        response.once("error", reject);
        resolve({
          status: response.statusCode!,
          retryAfter: response.headers["retry-after"] ?? null
        });
        response.destroy();
      });
      outgoing.once("upgrade", (response, upgraded) => {
        resolve({ status: response.statusCode!, retryAfter: null });
        upgraded.destroy();
      });
      outgoing.end(payload);
    });
  } finally {
    agent.destroy();
    socket.destroy();
  }
};

export { sendWebhookRequest };
