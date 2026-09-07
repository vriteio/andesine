import { clientsClaim, setCacheNameDetails } from "workbox-core";
import {
  cleanupOutdatedCaches,
  getCacheKeyForURL,
  matchPrecache,
  precacheAndRoute
} from "workbox-precaching";
import type { PrecacheEntry } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

setCacheNameDetails({ prefix: "andesine" });
precacheAndRoute(self.__WB_MANIFEST, {
  cleanURLs: false,
  directoryIndex: "",
  ignoreURLParametersMatching: []
});
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Let the precache route handle direct requests for static files.
  if (getCacheKeyForURL(url.href)) return;

  event.respondWith(
    fetch(request).catch(async () => {
      return (await matchPrecache("/offline.html")) || Response.error();
    })
  );
});
