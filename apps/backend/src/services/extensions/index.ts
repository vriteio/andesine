import { approve } from "./approve";
import { createSessionToken } from "./create-session-token";
import { development } from "./development";
import { get } from "./get";
import { getCatalogItem } from "./get-catalog-item";
import { getConfiguration } from "./get-configuration";
import { getSelf } from "./get-self";
import { getSelfConfiguration } from "./get-self-configuration";
import { getSelfDelivery } from "./get-self-delivery";
import { install } from "./install";
import { listInstallations } from "./list-installations";
import { listRuntime } from "./list-runtime";
import { listWebhooks } from "./list-webhooks";
import { verifySession } from "./verify-session";
import { list } from "./list";
import { listActiveViews } from "./list-active-views";
import { listCatalog } from "./list-catalog";
import { listElementViews } from "./list-element-views";
import { redeliverWebhook } from "./redeliver-webhook";
import { sendWebhookTest } from "./send-webhook-test";
import { setConfiguration } from "./set-configuration";
import { setEnabled } from "./set-enabled";
import { setWebhookEnabled } from "./set-webhook-enabled";
import { setElementViewEnabled } from "./set-element-view-enabled";
import { storage } from "./storage";
import { uninstall } from "./uninstall";
import { webhookHistory } from "./webhook-history";

const Extensions = {
  approve,
  createSessionToken,
  development,
  get,
  getCatalogItem,
  getConfiguration,
  getSelf,
  getSelfConfiguration,
  getSelfDelivery,
  install,
  list,
  listActiveViews,
  listCatalog,
  listElementViews,
  listInstallations,
  listRuntime,
  listWebhooks,
  redeliverWebhook,
  sendWebhookTest,
  setConfiguration,
  setElementViewEnabled,
  setEnabled,
  setWebhookEnabled,
  storage,
  uninstall,
  webhookHistory,
  verifySession
};

export { Extensions };
