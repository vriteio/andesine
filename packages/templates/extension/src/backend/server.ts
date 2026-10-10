import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createExtensionBackend,
  ExtensionNotificationError,
  ExtensionSessionError
} from "@andesine/sdk/extensions";

const extension = createExtensionBackend({
  name: "example/hello",
  // The private key from `andesine extensions keys generate`, as a JSON Web Key.
  privateKey: process.env.ANDESINE_EXTENSION_KEY ?? "",
  // API URLs of the Andesine instances that this backend works with.
  trustedInstances: (process.env.ANDESINE_INSTANCES ?? "https://api.andesine.app").split(",")
});

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) chunks.push(chunk as Buffer);

  return Buffer.concat(chunks).toString("utf8");
};
const send = (response: ServerResponse, status: number, body?: unknown): void => {
  response.writeHead(status, body === undefined ? {} : { "content-type": "application/json" });
  response.end(body === undefined ? undefined : JSON.stringify(body));
};
// The extension frontend calls the backend from the browser, so it needs CORS.
const allowFrontend = (response: ServerResponse): void => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "POST, OPTIONS");
  response.setHeader(
    "access-control-allow-headers",
    "authorization, content-type, andesine-extension, andesine-instance"
  );
};
const server = createServer(async (request, response) => {
  allowFrontend(response);

  try {
    if (request.method === "OPTIONS") {
      send(response, 204);
    } else if (request.method === "POST" && request.url === "/webhooks") {
      // Fetching the delivery with the extension's key confirms the notification.
      const { event, client } = await extension.receive(await readBody(request));

      if (event.type === "entry.created") {
        // The client acts for the installation, with the extension's permissions.
        const entry = await client.entries.get({ id: event.subject.id });

        console.log(`Entry created: ${entry.name}`);
      } else {
        console.log(`Received ${event.type}`);
      }

      send(response, 204);
    } else if (request.method === "POST" && request.url === "/hello") {
      const session = await extension.verifySession(request.headers);
      // Secret fields are readable only here, with the extension's own credentials.
      const { values } = await session.client.extensions.getSelfConfiguration();

      console.log(`API token ${values.apiToken ? "set" : "not set"}`);
      send(response, 200, {
        name: session.member.profile.name ?? session.member.profile.email ?? "member"
      });
    } else {
      send(response, 404);
    }
  } catch (error) {
    const isRejected =
      error instanceof ExtensionSessionError || error instanceof ExtensionNotificationError;

    if (!isRejected) console.error(error);

    send(response, isRejected ? 401 : 500);
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Backend listening on port ${process.env.PORT ?? 3000}`);
});
