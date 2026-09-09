interface AssetProcessJobData {
  assetID: string;
  workspaceID: string;
}

interface ProfileImageJobData {
  assetID: string;
}

const ASSET_ANALYSIS_JOB_NAME = "asset-analysis";
const PROFILE_IMAGE_JOB_NAME = "profile-image-process";
const ASSET_PROCESS_JOB_NAME = "asset-process";

export { ASSET_ANALYSIS_JOB_NAME, ASSET_PROCESS_JOB_NAME, PROFILE_IMAGE_JOB_NAME };
export type { AssetProcessJobData, ProfileImageJobData };
