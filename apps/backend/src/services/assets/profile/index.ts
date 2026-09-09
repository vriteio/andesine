import { deleteUserImages } from "./delete-user";
import { getProfileImage } from "./get";
import { getProfileImageUpload } from "./get-upload";
import { removeProfileImage } from "./remove";
import { setProfileImage } from "./set";
import { uploadProfileImage } from "./upload";

const Profile = {
  deleteUser: deleteUserImages,
  get: getProfileImage,
  getUpload: getProfileImageUpload,
  remove: removeProfileImage,
  set: setProfileImage,
  upload: uploadProfileImage
};

export { Profile };
