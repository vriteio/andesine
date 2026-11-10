interface LoaderInit {
  type: string;
  protocol: number;
  extensionID: string;
  generation: number;
  code: string;
}

/**
 * The only sandbox document script, inlined with `toString()`; it must stay self-contained (no
 * imports, outer variables, or helpers). The bundle runs in a blob Worker, which inherits the
 * document's CSP, so extension code never runs on the document's thread.
 */
const runLoader = (protocol: number): void => {
  let started = false;

  addEventListener("message", (event: MessageEvent) => {
    const data = event.data as Partial<LoaderInit> | null;
    const isInit =
      event.source === parent &&
      event.ports.length === 1 &&
      typeof data === "object" &&
      data !== null &&
      data.type === "andesine:init" &&
      data.protocol === protocol &&
      typeof data.code === "string";

    if (started || !isInit) return;

    started = true;

    const url = URL.createObjectURL(new Blob([data.code!], { type: "text/javascript" }));
    // A classic worker: module workers refuse blob scripts from the sandbox's opaque origin.
    const worker = new Worker(url, { name: "extension" });
    const init = {
      type: "andesine:init",
      protocol,
      extensionID: data.extensionID,
      generation: data.generation
    };

    worker.postMessage(init, [event.ports[0]]);
  });
  parent.postMessage({ type: "andesine:ready", protocol }, "*");
};

export { runLoader };
