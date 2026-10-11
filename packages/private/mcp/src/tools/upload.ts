import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toAssetID } from "@andesine/contracts/primitives";
import * as z from "zod";
import { resolveEntryID, runTool, type ToolContext } from "../context";

interface LocalFile {
  data: Uint8Array<ArrayBuffer>;
  filename: string;
}

type ReadLocalFile = (path: string) => Promise<LocalFile>;

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 500;

const toHex = (buffer: ArrayBuffer): string => {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const waitUntilReady = async (context: ToolContext, assetID: string): Promise<void> => {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  let { status, failureReason } = await context.client.assets.get({ assetID });

  while (status !== "ready") {
    if (status === "failed") throw new Error(`The image failed processing: ${failureReason}`);
    if (Date.now() > deadline) throw new Error(`The image is still processing; asset ${assetID}`);

    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
    ({ status, failureReason } = await context.client.assets.get({ assetID }));
  }
};

/** Registers upload_image, for servers that run on the user's machine and can read local files. */
const createUploadTool = (readLocalFile: ReadLocalFile) => {
  return (server: McpServer, context: ToolContext) => {
    server.registerTool(
      "upload_image",
      {
        title: "Upload a local image",
        description:
          "Uploads a local PNG, JPEG, or WebP file for an entry and returns its MDX image. Insert the image with edit_entry; images by URL don't need an upload.",
        inputSchema: {
          entry: z.string().describe("Entry ID (ent_...) or path that uses the image"),
          path: z.string().describe("Path of the local image file"),
          alt: z.string().default("").describe("Alternative text")
        },
        annotations: {
          title: "Upload a local image",
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false
        }
      },
      runTool(async ({ entry, path, alt }) => {
        const extension = path.split(".").pop()?.toLowerCase() ?? "";
        const type = IMAGE_TYPES[extension];

        if (!type) throw new Error("Use a PNG, JPEG, or WebP file");

        const entryID = await resolveEntryID(context, entry);
        const { data, filename } = await readLocalFile(path);
        const assetID = toAssetID(crypto.randomUUID());

        await context.client.assets.register({
          assetID,
          entryID,
          filename,
          byteSize: data.byteLength,
          checksum: toHex(await crypto.subtle.digest("SHA-256", data))
        });
        await context.client.assets.upload({
          assetID,
          file: new File([data], filename, { type })
        });
        await waitUntilReady(context, assetID);

        return { assetID, mdx: `![${alt}](asset:${assetID})` };
      })
    );
  };
};

export { createUploadTool };
export type { LocalFile, ReadLocalFile };
