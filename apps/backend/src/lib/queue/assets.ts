import { searchIndexingQueue } from "./client";
import {
  ASSET_PROCESS_JOB_NAME,
  PROFILE_IMAGE_JOB_NAME,
  type AssetProcessJobData,
  type ProfileImageJobData
} from "./asset-jobs";

const enqueueAssetProcessing = async (data: AssetProcessJobData): Promise<void> => {
  await searchIndexingQueue.add(ASSET_PROCESS_JOB_NAME, data, {
    jobId: `asset-${data.assetID}`,
    removeOnComplete: true,
    removeOnFail: true
  });
};

const enqueueProfileImageProcessing = async (data: ProfileImageJobData): Promise<void> => {
  await searchIndexingQueue.add(PROFILE_IMAGE_JOB_NAME, data, {
    jobId: `profile-image-${data.assetID}`,
    removeOnComplete: true,
    removeOnFail: true
  });
};

export { enqueueAssetProcessing, enqueueProfileImageProcessing };
