import { request } from "./requests";

// Host actions need a recent user interaction, e.g. `onClick`; errors are `ExtensionRequestError`.

/** Copies text; the host shows a fallback dialog if the browser refuses. */
const copyText = async (text: string): Promise<void> => {
  await request("host.copyText", { text });
};
/** Downloads a text file, for example `downloadFile("andesine.config.ts", source)`. */
const downloadFile = async (name: string, text: string, type?: string): Promise<void> => {
  await request("host.downloadFile", type ? { name, text, type } : { name, text });
};
/** Opens an `https:` URL in a new tab; URLs outside the declared URLs need confirmation. */
const openURL = async (url: string): Promise<void> => {
  await request("host.openURL", { url });
};

/** Shows a short notification, e.g. the result of a block action without UI; it needs no interaction. */
const notify = async (text: string, type?: "success" | "error"): Promise<void> => {
  await request("host.notify", type ? { text, type } : { text });
};

export { copyText, downloadFile, openURL, notify };
