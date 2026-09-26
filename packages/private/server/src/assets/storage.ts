import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import type { AssetConfig } from "./config-schema";

interface AssetOwner {
  workspaceID: string | null;
  userID: string | null;
}

const ASSET_PROFILE_SIZE = 512;
const getUserAssetPrefix = (userID: string): string => `users/${userID}/assets/`;
const getUserAssetStagingPrefix = (userID: string): string => `staging/users/${userID}/`;
const getOwnedAssetPrefix = (owner: AssetOwner, assetID: string): string => {
  if (owner.workspaceID) return getAssetPrefix(owner.workspaceID, assetID);
  if (owner.userID) return `${getUserAssetPrefix(owner.userID)}${assetID}/`;
  throw new Error("Image owner is missing");
};
const getOwnedAssetStagingPrefix = (owner: AssetOwner, assetID: string): string => {
  if (owner.workspaceID) return getAssetStagingPrefix(owner.workspaceID, assetID);
  if (owner.userID) return `${getUserAssetStagingPrefix(owner.userID)}${assetID}/`;
  throw new Error("Image owner is missing");
};
const getOwnedAssetUploadKey = (owner: AssetOwner, assetID: string): string =>
  `${getOwnedAssetStagingPrefix(owner, assetID)}upload`;
const getProfileImageReservationBytes = (byteSize: number): number =>
  byteSize + ASSET_PROFILE_SIZE ** 2 * 4 + 1024 ** 2;

const ASSET_DISPLAY_SIZE = 4096;
const ASSET_THUMBNAIL_SIZE = 512;
const getWorkspaceAssetPrefix = (workspaceID: string): string =>
  `workspaces/${workspaceID}/assets/`;
const getAssetPrefix = (workspaceID: string, assetID: string): string =>
  `${getWorkspaceAssetPrefix(workspaceID)}${assetID}/`;
const getWorkspaceAssetStagingPrefix = (workspaceID: string): string => `staging/${workspaceID}/`;
const getAssetStagingPrefix = (workspaceID: string, assetID: string): string =>
  `${getWorkspaceAssetStagingPrefix(workspaceID)}${assetID}/`;
const getAssetUploadKey = (workspaceID: string, assetID: string): string =>
  `${getAssetStagingPrefix(workspaceID, assetID)}upload`;
// Reserve raw RGBA output sizes plus encoder overhead, then enforce this bound during processing.
const getAssetReservationBytes = (byteSize: number): number => {
  return byteSize + (ASSET_DISPLAY_SIZE ** 2 + ASSET_THUMBNAIL_SIZE ** 2) * 4 + 2 * 1024 ** 2;
};
const createAssetStorage = (config: AssetConfig) => {
  if (!config.ASSET_S3_BUCKET) return null;

  const hasPartialCredentials =
    Boolean(config.ASSET_S3_ACCESS_KEY_ID) !== Boolean(config.ASSET_S3_SECRET_ACCESS_KEY);

  if (hasPartialCredentials) throw new Error("Both asset S3 credentials must be set together");

  const client = new S3Client({
    region: config.ASSET_S3_REGION || "us-east-1",
    endpoint: config.ASSET_S3_ENDPOINT,
    forcePathStyle: config.ASSET_S3_FORCE_PATH_STYLE,
    maxAttempts: 2,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials:
      config.ASSET_S3_ACCESS_KEY_ID && config.ASSET_S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: config.ASSET_S3_ACCESS_KEY_ID,
            secretAccessKey: config.ASSET_S3_SECRET_ACCESS_KEY
          }
        : undefined
  });
  const bucket = config.ASSET_S3_BUCKET;

  return {
    client,
    bucket,
    async put(key: string, body: Buffer, contentType: string): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length
        }),
        { abortSignal: AbortSignal.timeout(30_000) }
      );
    },
    async read(key: string, maximumBytes: number): Promise<Buffer> {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(30_000)
      });
      const body = response.Body;
      const chunks: Buffer[] = [];
      let size = 0;

      if (!body) throw new Error("Image file has no body");

      if ((response.ContentLength || 0) > maximumBytes) {
        if ("destroy" in body) body.destroy();
        throw new Error("Image file exceeds its upload limit");
      }

      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        size += chunk.length;
        if (size > maximumBytes) throw new Error("Image file exceeds its upload limit");
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    },
    async removeKeys(keys: string[]): Promise<void> {
      if (!keys.length) return;

      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) }
        }),
        { abortSignal: AbortSignal.timeout(30_000) }
      );

      if (result.Errors?.length) throw new Error("Some image files could not be deleted");
    },
    async removePrefix(prefix: string): Promise<void> {
      const isAssetPrefix =
        /^(?:workspaces|users)\/[a-f0-9-]{36}\/assets\/(?:[a-f0-9-]{36}\/)?$/.test(prefix);
      const isStagingPrefix = /^staging\/(?:users\/)?[a-f0-9-]{36}\/(?:[a-f0-9-]{36}\/)?$/.test(
        prefix
      );
      if (!isAssetPrefix && !isStagingPrefix) {
        throw new Error("Invalid asset cleanup prefix");
      }

      // Read the first page again after each deletion, so retries never skip remaining objects.
      while (true) {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }),
          { abortSignal: AbortSignal.timeout(30_000) }
        );
        const keys = (page.Contents || []).flatMap(({ Key }) => (Key ? [Key] : []));

        if (!keys.length) return;
        await this.removeKeys(keys);
      }
    }
  };
};

type AssetStorage = NonNullable<ReturnType<typeof createAssetStorage>>;

export {
  ASSET_PROFILE_SIZE,
  getUserAssetPrefix,
  getUserAssetStagingPrefix,
  getOwnedAssetPrefix,
  getOwnedAssetStagingPrefix,
  getOwnedAssetUploadKey,
  getProfileImageReservationBytes,
  ASSET_DISPLAY_SIZE,
  ASSET_THUMBNAIL_SIZE,
  createAssetStorage,
  getAssetPrefix,
  getAssetReservationBytes,
  getAssetUploadKey,
  getAssetStagingPrefix,
  getWorkspaceAssetStagingPrefix,
  getWorkspaceAssetPrefix
};
export type { AssetOwner, AssetStorage };
