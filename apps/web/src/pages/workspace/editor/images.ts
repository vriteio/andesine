import { createComponent } from "solid-js";
import { ImagePicker } from "../image-search";
import type { EditorImageAsset, EditorImages } from "@andesine/editor";
import { client } from "#web/lib/api";
import { fromUUID, generateUUID } from "#web/lib/primitives";
import { cacheImage, pruneCachedImages, readCachedImage } from "#web/context/workspace/image-cache";
import { getWorkspaceDatabaseName } from "#web/context/workspace/indexeddb";
import { isOffline } from "#web/lib/offline";

interface EntryImagesOptions {
  workspaceID: string;
  userID: string;
  entryID: string;
  enabled(): boolean;
  cache?: boolean;
}

const createEntryImages = (options: EntryImagesOptions): EditorImages => {
  const databaseName = getWorkspaceDatabaseName(options.workspaceID, options.userID);
  const context = { headers: { "x-workspace-id": options.workspaceID } };
  const enabled = () => !isOffline() && options.enabled();
  const assertEnabled = () => {
    if (!enabled()) throw new Error("Connect to upload, insert, or replace images");
  };
  const get = async (assetID: string, signal: AbortSignal) => {
    return (await client.assets.get({ assetID, entryID: options.entryID }, { context, signal }))
      .body;
  };

  const reuseImage = async (assetID: string, signal: AbortSignal): Promise<EditorImageAsset> => {
    signal.throwIfAborted();
    assertEnabled();
    await client.assets.attach({ assetID, entryID: options.entryID }, { context, signal });
    return waitForImage(assetID, signal);
  };

  const waitForImage = async (assetID: string, signal: AbortSignal): Promise<EditorImageAsset> => {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      assertEnabled();
      const details = await get(assetID, signal);

      if (details.status === "ready") {
        const display = details.files.find(({ variant }) => variant === "display");

        if (!display) throw new Error("Image is not available");

        return { assetID, width: display.width, height: display.height };
      }
      if (details.status === "failed" || details.status === "deleting")
        throw new Error(details.failureReason || "Image processing failed");
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, 1500);

        signal.addEventListener("abort", abort, { once: true });
      });
    }
    throw new Error("Image processing took too long. Try again later.");
  };

  return {
    enabled,
    renderPicker: (props) => {
      return createComponent(ImagePicker, { ...props, workspaceID: options.workspaceID });
    },
    async load(assetID, signal, onCached) {
      signal.throwIfAborted();
      const cached =
        options.cache === false
          ? null
          : await readCachedImage(databaseName, options.entryID, assetID).catch(() => null);

      signal.throwIfAborted();
      if (cached) onCached?.(cached);

      if (isOffline()) {
        if (!cached) throw new Error("This image is not cached. Connect to view it.");
        return cached;
      }
      const details = await get(assetID, signal).catch(async (error: unknown) => {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          ["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED"].includes(String(error.code))
        ) {
          await pruneCachedImages(
            databaseName,
            (entryID, id) => entryID !== options.entryID || id !== assetID
          ).catch(() => undefined);
        }
        throw error;
      });
      if (details.status !== "ready")
        throw new Error(details.failureReason || "Image is still processing");

      signal.throwIfAborted();
      if (cached) return cached;

      const file = details.files.find(({ variant }) => variant === "display");

      if (!file) throw new Error("Image is not available");

      const response = await fetch(file.url, { signal, credentials: "omit", cache: "no-store" });

      if (!response.ok) throw new Error("Image download failed. Try again.");

      const blob = await response.blob();

      if (blob.size !== file.byteSize) throw new Error("Image download is incomplete. Try again.");
      signal.throwIfAborted();
      if (options.cache !== false) {
        await cacheImage(databaseName, options.entryID, assetID, blob, signal).catch(
          () => undefined
        );
      }
      signal.throwIfAborted();
      return blob;
    },
    async upload(file, signal, onDuplicate) {
      assertEnabled();
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("Choose a JPEG, PNG, or static WebP image");
      if (file.size > 64 * 1024 * 1024) throw new Error("Image file is too large");
      if (!file.size) throw new Error("The image file is empty");

      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const checksum = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join("");
      const assetID = fromUUID(generateUUID(), "ast");

      assertEnabled();

      if (onDuplicate) {
        const { body: duplicates } = await client.assets.search(
          { query: "", checksum, limit: 1 },
          { context, signal }
        );
        const duplicate = duplicates[0];

        signal.throwIfAborted();
        if (duplicate) {
          const choice = await onDuplicate(duplicate);

          signal.throwIfAborted();
          assertEnabled();
          if (choice === "cancel") return null;
          if (choice === "reuse") return reuseImage(duplicate.assetID, signal);
        }
      }
      await client.assets.register(
        {
          assetID,
          entryID: options.entryID,
          filename: file.name || "image",
          byteSize: file.size,
          checksum
        },
        { context, signal }
      );
      await client.assets.upload({ assetID, file }, { context, signal });
      return waitForImage(assetID, signal);
    },
    async uploadURL(url, signal, onDuplicate) {
      assertEnabled();
      const assetID = fromUUID(generateUUID(), "ast");
      const { body } = await client.assets.importURL(
        { assetID, entryID: options.entryID, url, checkDuplicates: Boolean(onDuplicate) },
        { context, signal }
      );
      signal.throwIfAborted();
      if ("duplicate" in body) {
        const choice = await onDuplicate!(body.duplicate);

        signal.throwIfAborted();
        assertEnabled();
        if (choice === "cancel") return null;
        if (choice === "reuse") return reuseImage(body.duplicate.assetID, signal);
        // Keep no server-side bytes while the user decides. Repeat the bounded download.
        await client.assets.importURL(
          { assetID, entryID: options.entryID, url, checkDuplicates: false },
          { context, signal }
        );
      }
      return waitForImage(assetID, signal);
    },
    async attach(assetIDs, signal) {
      for (const assetID of new Set(assetIDs)) {
        assertEnabled();
        await client.assets.attach({ assetID, entryID: options.entryID }, { context, signal });
      }
    }
  };
};

export { createEntryImages };
