import { searchAssets } from "./search";
import { Profile } from "./profile";
import { getPublishedAsset } from "./get-published";
import { importAssetURL } from "./import-url";
import { attachAsset } from "./attach";
import { getAsset } from "./get";
import { registerAsset } from "./register";
import { storeAssetUpload } from "./upload";

const Asset = {
  Profile,
  search: searchAssets,
  attach: attachAsset,
  importURL: importAssetURL,
  get: getAsset,
  getPublished: getPublishedAsset,
  register: registerAsset,
  upload: storeAssetUpload
};

export { Asset };
export type { AssetDetails } from "./get";
