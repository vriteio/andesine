import { prepareMCPResource } from "./prepare-mcp-resource";
import { provision } from "./provision";
import { getSessionData } from "./get-session-data";
import { getDeviceRequest } from "./get-device-request";
import { respondToDeviceRequest } from "./respond-to-device-request";
import { listConnectedApps } from "./list-connected-apps";
import { revokeConnectedApp } from "./revoke-connected-app";
import { selectConsentWorkspace } from "./select-consent-workspace";
import { getConsentWorkspace } from "./get-consent-workspace";
import { clearConsentWorkspace } from "./clear-consent-workspace";

const OAuth = {
  getDeviceRequest,
  respondToDeviceRequest,
  listConnectedApps,
  revokeConnectedApp,
  selectConsentWorkspace,
  getConsentWorkspace,
  clearConsentWorkspace,
  getSessionData,
  prepareMCPResource,
  provision
};

export { OAuth };
