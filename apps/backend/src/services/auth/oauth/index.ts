import { provision } from "./provision";
import { getSessionData } from "./get-session-data";
import { getDeviceRequest } from "./get-device-request";
import { respondToDeviceRequest } from "./respond-to-device-request";

const OAuth = {
  getDeviceRequest,
  respondToDeviceRequest,
  getSessionData,
  provision
};

export { OAuth };
