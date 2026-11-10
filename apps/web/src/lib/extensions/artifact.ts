import { type ExtensionArtifact } from "@andesine/contracts/extensions";

// A stalled request (e.g. queued behind the browser's per-host connection limit) fails, so it can be retried.
const ARTIFACT_TIMEOUT = 15_000;

const toBase64 = (hex: string): string => {
  return btoa(String.fromCharCode(...(hex.match(/../g) || []).map((byte) => parseInt(byte, 16))));
};
/** Loads a registry artifact; the browser rejects content that does not match its SHA-256 hash. */
const loadExtensionArtifact = async (artifact: ExtensionArtifact): Promise<string> => {
  const response = await fetch(artifact.url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    integrity: `sha256-${toBase64(artifact.sha256)}`,
    signal: AbortSignal.timeout(ARTIFACT_TIMEOUT)
  });

  if (!response.ok) throw new Error(`Extension artifact unavailable (HTTP ${response.status})`);

  const content = await response.arrayBuffer();

  if (content.byteLength !== artifact.size) {
    throw new Error("Extension artifact size does not match");
  }

  return new TextDecoder().decode(content);
};

export { loadExtensionArtifact };
