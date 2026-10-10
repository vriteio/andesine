import {
  EXTENSION_PROTOCOL_VERSION,
  extensionLoaderReadyType,
  extensionProtocolLimits,
  extensionWorkerMessageType,
  type ExtensionHostMessageBody,
  type ExtensionWorkerMessage
} from "@andesine/contracts/extensions";
import { createLoaderDocument } from "./loader";

interface ExtensionSandboxOptions {
  extensionID: string;
  /** The verified frontend bundle. */
  code: string;
  /** The backend URL and the declared request URLs. */
  connectSources: string[];
  container?: HTMLElement;
  onMessage?(message: ExtensionWorkerMessage): void;
  onFailure?(reason: ExtensionSandboxFailure): void;
}
interface ExtensionSandbox {
  generation: number;
  /** Resolves when the worker reports `ready`; rejects with the failure reason. */
  ready: Promise<void>;
  send(body: ExtensionHostMessageBody): void;
  dispose(): void;
}

type ExtensionSandboxFailure =
  "handshake_timeout" | "heartbeat_timeout" | "navigated" | "protocol_error";

const generations = new Map<string, number>();

const getMessageSize = (data: unknown): number => {
  try {
    return JSON.stringify(data)?.length ?? Infinity;
  } catch {
    return Infinity;
  }
};
/**
 * Runs the extension Worker in a sandboxed `srcdoc` iframe: opaque origin, CSP limited to declared
 * URLs. Each start increments the extension's generation; messages of other generations fail.
 */
const createExtensionSandbox = async (
  options: ExtensionSandboxOptions
): Promise<ExtensionSandbox> => {
  const generation = (generations.get(options.extensionID) || 0) + 1;
  const srcdoc = await createLoaderDocument(options.connectSources);
  const iframe = document.createElement("iframe");
  const channel = new MessageChannel();
  const port = channel.port1;
  const { promise: ready, resolve, reject } = Promise.withResolvers<void>();

  let state: "loading" | "connecting" | "ready" | "disposed" = "loading";
  let loads = 0;
  let sendSequence = 0;
  let receiveSequence = 0;
  let heartbeatID = 0;
  let answeredHeartbeat = 0;
  let heartbeatSentAt = 0;
  let unansweredChecks = 0;
  let windowStart = 0;
  let windowCount = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  const send = (body: ExtensionHostMessageBody): void => {
    if (state !== "ready") return;

    port.postMessage({
      ...body,
      protocol: EXTENSION_PROTOCOL_VERSION,
      generation,
      sequence: sendSequence++
    });
  };
  const dispose = (): void => {
    if (state === "disposed") return;

    send({ type: "dispose" });
    state = "disposed";
    clearTimeout(handshakeTimer);
    clearInterval(heartbeatTimer);
    window.removeEventListener("message", handleWindowMessage);
    port.close();
    // Removing the iframe terminates its worker.
    iframe.remove();
    reject(new Error("Extension sandbox disposed"));
  };
  const fail = (reason: ExtensionSandboxFailure): void => {
    if (state === "disposed") return;

    dispose();
    options.onFailure?.(reason);
  };
  const isOverRateLimit = (): boolean => {
    const now = Date.now();

    if (now - windowStart >= 1000) {
      windowStart = now;
      windowCount = 0;
    }

    windowCount += 1;

    return windowCount > extensionProtocolLimits.messagesPerSecond;
  };
  // Background tabs run timers about once a minute, so only a heartbeat that stays unanswered
  // counts; the first late check after a pause waits for replies that are already queued.
  const startHeartbeat = (): void => {
    heartbeatTimer = setInterval(() => {
      const isUnanswered = answeredHeartbeat < heartbeatID;
      const isLate = Date.now() - heartbeatSentAt > extensionProtocolLimits.heartbeatTimeout;

      if (isUnanswered) {
        unansweredChecks += 1;

        if (isLate && unansweredChecks > 1) fail("heartbeat_timeout");

        return;
      }

      unansweredChecks = 0;
      heartbeatSentAt = Date.now();
      send({ type: "heartbeat", id: ++heartbeatID });
    }, extensionProtocolLimits.heartbeatInterval);
  };
  const handlePortMessage = (event: MessageEvent): void => {
    if (state === "disposed") return;

    const isOversized = getMessageSize(event.data) > extensionProtocolLimits.messageSize;
    const result = isOversized ? null : extensionWorkerMessageType.safeParse(event.data);
    const message = result?.success ? result.data : null;
    const isInvalid =
      !message ||
      isOverRateLimit() ||
      message.generation !== generation ||
      message.sequence !== receiveSequence ||
      (message.type === "ready") !== (state === "connecting") ||
      (message.type === "heartbeat" && message.id > heartbeatID);

    if (isInvalid) {
      fail("protocol_error");

      return;
    }

    receiveSequence += 1;

    if (message.type === "ready") {
      state = "ready";
      clearTimeout(handshakeTimer);
      startHeartbeat();
      resolve();
    } else if (message.type === "heartbeat") {
      answeredHeartbeat = Math.max(answeredHeartbeat, message.id);
    }

    // Invalid content (for example a patch the view tree rejects) is a protocol error.
    try {
      options.onMessage?.(message);
    } catch {
      fail("protocol_error");
    }
  };
  // Only the loader's first `ready` from this iframe counts; `event.origin` is always "null".
  const handleWindowMessage = (event: MessageEvent): void => {
    const isFromLoader = event.source === iframe.contentWindow && state === "loading";

    if (!isFromLoader) return;

    if (!extensionLoaderReadyType.safeParse(event.data).success) {
      fail("protocol_error");

      return;
    }

    state = "connecting";
    window.removeEventListener("message", handleWindowMessage);
    iframe.contentWindow!.postMessage(
      {
        type: "andesine:init",
        protocol: EXTENSION_PROTOCOL_VERSION,
        extensionID: options.extensionID,
        generation,
        code: options.code
      },
      "*",
      [channel.port2]
    );
  };
  const handshakeTimer = setTimeout(() => {
    fail("handshake_timeout");
  }, extensionProtocolLimits.handshakeTimeout);

  generations.set(options.extensionID, generation);
  ready.catch(() => {});
  port.addEventListener("message", handlePortMessage);
  port.addEventListener("messageerror", () => fail("protocol_error"));
  port.start();
  window.addEventListener("message", handleWindowMessage);
  // A second load means the frame navigated away from the loader document.
  iframe.addEventListener("load", () => {
    loads += 1;

    if (loads > 1) fail("navigated");
  });
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("allow", "");
  iframe.setAttribute("aria-hidden", "true");
  iframe.referrerPolicy = "no-referrer";
  iframe.tabIndex = -1;
  iframe.title = "Extension sandbox";
  iframe.hidden = true;
  iframe.srcdoc = srcdoc;
  (options.container || document.body).append(iframe);

  return {
    generation,
    ready,
    send,
    dispose
  };
};

export { createExtensionSandbox };
export type { ExtensionSandbox, ExtensionSandboxFailure, ExtensionSandboxOptions };
