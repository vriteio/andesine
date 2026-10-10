import { EXTENSION_PROTOCOL_VERSION } from "@andesine/contracts/extensions";
import { runLoader } from "./loader-script";

// The CSP hash is computed from this exact string at runtime, so minification cannot break it.
const LOADER_SCRIPT = `(${runLoader.toString()})(${EXTENSION_PROTOCOL_VERSION});`;
const UNSAFE_SOURCE = /[\s;,'"]/;

const hashScript = async (script: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(script));

  return btoa(String.fromCharCode(...new Uint8Array(digest)));
};
/** Generates the CSP; `connectSources` are manifest URLs (backend and declared requests). */
const createLoaderPolicy = async (connectSources: string[]): Promise<string> => {
  const sources = [...new Set(connectSources)];

  if (sources.some((source) => UNSAFE_SOURCE.test(source))) {
    throw new Error("Invalid extension connect source");
  }

  return [
    "default-src 'none'",
    `script-src 'sha256-${await hashScript(LOADER_SCRIPT)}'`,
    "worker-src blob:",
    `connect-src ${sources.join(" ") || "'none'"}`,
    "form-action 'none'",
    "base-uri 'none'"
  ].join("; ");
};
const createLoaderDocument = async (connectSources: string[]): Promise<string> => {
  const policy = await createLoaderPolicy(connectSources);

  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    '<meta name="referrer" content="no-referrer">',
    `</head><body><script>${LOADER_SCRIPT}</script></body></html>`
  ].join("");
};

export { createLoaderDocument, createLoaderPolicy };
