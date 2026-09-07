/* @refresh reload */
import { hydrate, render } from "solid-js/web";
import App from "./app";
import { readOfflineState } from "./lib/offline";

const root = document.getElementById("app")!;

if (document.documentElement.hasAttribute("data-offline-shell")) {
  if (readOfflineState()) {
    root.replaceChildren();
    render(() => <App />, root);
  }
} else {
  hydrate(() => <App />, root);
}

if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
  const registerServiceWorker = () => {
    void navigator.serviceWorker
      .register("/service-worker.js", { type: "module", updateViaCache: "none" })
      .catch((error) => console.error("Failed to register service worker", error));
  };

  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker, { once: true });
  }
}
