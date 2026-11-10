import { toAssetID } from "@andesine/contracts/primitives";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { getAsset } from "./get";
import { importAssetURL } from "./import-url";

interface ImportContentImagesInput {
  entryID: string;
  urls: string[];
}

const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 500;

const contentImageUnavailableError = (url: string, assetID: string, status: string) => {
  return new ORPCError("CONTENT_IMAGE_UNAVAILABLE", {
    status: 409,
    message: `Image ${url} is ${status === "failed" ? "not usable" : "still processing"}`,
    data: {
      url,
      assetID,
      assetStatus: status,
      hints: [
        status === "failed"
          ? "Check assets.get for the failure reason, and use another image."
          : "Retry the write later; the image keeps processing and is reused as a duplicate."
      ]
    }
  });
};

/**
 * Imports image URLs for the entry and waits until the images are ready, because content saves
 * drop images that aren't ready. Call it before the content transaction: downloads are slow.
 * @returns Asset IDs by URL. Existing images with the same file are reused.
 */
const importContentImages = withAuthorization<
  ImportContentImagesInput,
  undefined,
  Map<string, string>
>({}, async ({ auth, input }) => {
  const assetIDs = new Map<string, string>();
  const deadline = Date.now() + READY_TIMEOUT_MS;

  for (const url of new Set(input.urls)) {
    const result = await importAssetURL({
      auth,
      assetID: toAssetID(crypto.randomUUID()),
      entryID: input.entryID,
      url,
      checkDuplicates: true
    });

    assetIDs.set(url, "assetID" in result ? result.assetID : result.duplicate.assetID);
  }

  for (const [url, assetID] of assetIDs) {
    let { status } = await getAsset({ auth, assetID });

    while (status !== "ready") {
      const waiting = status !== "failed" && Date.now() < deadline;

      if (!waiting) throw contentImageUnavailableError(url, assetID, status);

      await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
      ({ status } = await getAsset({ auth, assetID }));
    }
  }

  return assetIDs;
});

export { importContentImages };
