import { searchAssets } from "./search";
import { Profile } from "./profile";
import { getPublishedAsset } from "./get-published";
import { importAssetURL } from "./import-url";
import { attachAsset } from "./attach";
import { grantContentAssets } from "./grant-content";
import { importContentImages } from "./import-content-images";
import { getAsset } from "./get";
import { registerAsset } from "./register";
import { storeAssetUpload } from "./upload";

const Asset = {
  Profile,
  search: searchAssets,
  attach: attachAsset,
  grantContent: grantContentAssets,
  importContentImages,
  importURL: importAssetURL,
  get: getAsset,
  getPublished: getPublishedAsset,
  register: registerAsset,
  upload: storeAssetUpload
};

export { Asset };
export type { AssetDetails } from "./get";
