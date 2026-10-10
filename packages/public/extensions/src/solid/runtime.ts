import { catchError, type Component } from "solid-js";
import { ViewContext } from "./editor";
import { createStore, reconcile } from "solid-js/store";
import {
  createComponent,
  createViewRoot,
  getCallback,
  removeViewRoot,
  render,
  setPatchSender,
  type ViewNode
} from "./renderer";
import type { Envelope, HostMessageBody, WorkerMessageBody } from "./protocol";
import { setRequestSender, settleRequest } from "./requests";
import { updateContext, updateSession } from "./context";

interface RunningView {
  root: ViewNode;
  setProps(props: Record<string, unknown>): void;
  dispose(): void;
}

type ExtensionViews = Record<string, Component<never>>;

const PROTOCOL: Envelope["protocol"] = 1;
// Context providers return their children, which are view nodes in this renderer.
const ViewProvider = ViewContext.Provider as unknown as (props: {
  value: string;
  children: ViewNode;
}) => ViewNode;
const views = new Map<string, RunningView>();

let started = false;

const getErrorMessage = (error: unknown): string => {
  return String(error instanceof Error ? error.message : error).slice(0, 500);
};
/** Starts the frontend worker; `entries` maps manifest view entries to Solid components. */
const startExtension = (entries: ExtensionViews): void => {
  if (started) return;

  started = true;
  globalThis.addEventListener("message", function handleInit(event: MessageEvent) {
    const isInit = event.data?.type === "andesine:init" && event.ports.length === 1;

    if (!isInit) return;

    const port = event.ports[0];
    const generation = event.data.generation as number;

    let sequence = 0;

    // The host expects consecutive sequences, so a message that fails to clone must not use one.
    const send = (body: WorkerMessageBody): void => {
      port.postMessage({ ...body, protocol: PROTOCOL, generation, sequence });
      sequence += 1;
    };
    const sendError = (error: unknown, viewID?: string): void => {
      send({ type: "error", viewID, message: getErrorMessage(error) });
    };
    const createView = (viewID: string, entry: string, props: Record<string, unknown>): void => {
      // Solid components return JSX elements, which are view nodes in this renderer.
      const component = Object.hasOwn(entries, entry)
        ? (entries[entry] as unknown as (props: object) => ViewNode)
        : undefined;

      if (!component || views.has(viewID)) {
        sendError(`Unknown or duplicate view: ${entry}`, viewID);

        return;
      }

      const root = createViewRoot(viewID);
      const [viewProps, setViewProps] = createStore({ ...props });
      const dispose = render(() => {
        return catchError(
          () => {
            return createComponent(ViewProvider, {
              value: viewID,
              get children() {
                return createComponent(component, viewProps);
              }
            });
          },
          (error) => sendError(error, viewID)
        )!;
      }, root);

      views.set(viewID, {
        root,
        setProps: (next) => setViewProps(reconcile(next)),
        dispose
      });
    };
    const disposeView = (viewID: string): void => {
      const view = views.get(viewID);

      if (!view) return;

      views.delete(viewID);
      view.dispose();
      removeViewRoot(view.root);
    };
    const handleMessage = (message: HostMessageBody): void => {
      if (message.type === "heartbeat") {
        send({ type: "heartbeat", id: message.id });
      } else if (message.type === "view.create") {
        createView(message.viewID, message.entry, message.props);
      } else if (message.type === "view.update") {
        views.get(message.viewID)?.setProps(message.props);
      } else if (message.type === "view.dispose") {
        disposeView(message.viewID);
      } else if (message.type === "context") {
        updateContext(message);
      } else if (message.type === "session") {
        updateSession(message);
      } else if (message.type === "response") {
        settleRequest(message.id, message.result, message.error);
      } else if (message.type === "callback") {
        // Callbacks of removed nodes are released; late calls are ignored.
        getCallback(message.callback)?.(...message.args);
      } else if (message.type === "dispose") {
        [...views.keys()].forEach(disposeView);
        port.close();
        globalThis.close();
      }
    };

    globalThis.removeEventListener("message", handleInit);
    globalThis.addEventListener("error", (error) => sendError(error.message));
    globalThis.addEventListener("unhandledrejection", (event) => sendError(event.reason));
    setPatchSender((patches) => send({ type: "patch", patches }));
    setRequestSender((id, method, params) => send({ type: "request", id, method, params }));
    port.addEventListener("message", (event: MessageEvent<HostMessageBody>) => {
      try {
        handleMessage(event.data);
      } catch (error) {
        sendError(error);
      }
    });
    port.start();
    send({ type: "ready" });
  });
};

export { startExtension };
