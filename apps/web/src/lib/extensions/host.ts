import {
  type ExtensionHostMessageBody,
  type ExtensionSessionToken
} from "@andesine/contracts/extensions";
import {
  createRequestHandler,
  type ExtensionHostActions,
  type ExtensionViewTarget
} from "./requests";
import { type APIFetchContext } from "./api";
import { createExtensionSandbox, type ExtensionSandboxOptions } from "./sandbox";
import { createExtensionStyleSheet } from "./styles";
import { createExtensionTree, type ExtensionTree } from "./view-tree";

interface ExtensionHostOptions extends Omit<ExtensionSandboxOptions, "onMessage"> {
  /** The registry name; it scopes the extension CSS. */
  name: string;
  styles?: string;
  /** The verified manifest icon CSS of the version, for icons in host UI. */
  iconStyles?: string;
  getActions?(): ExtensionHostActions | null;
  getAPIContext?(): APIFetchContext;
  onError?(message: string, viewID?: string): void;
}
interface ExtensionHost {
  name: string;
  tree: ExtensionTree;
  /** The backend and declared request URLs. */
  sources: string[];
  ready: Promise<void>;
  /** Starts a view of a manifest entry and returns its view ID. */
  createView(entry: string, props?: ViewProps): string;
  updateView(viewID: string, props: ViewProps): void;
  disposeView(viewID: string): void;
  /** Sets what the view's edit requests act on; views without a target cannot edit. */
  setViewTarget(viewID: string, target: ExtensionViewTarget): void;
  /** Sends the member's effective permissions and the backend URL to the frontend. */
  setContext(context: ExtensionContext): void;
  setSession(session: ExtensionSessionToken | null): void;
  /** Calls an extension callback for a user interaction in one of its views. */
  invoke(callback: number, args: CallbackArguments): void;
  /** Records a user interaction outside the views, e.g. choosing a block action. */
  recordInteraction(): void;
  /** Whether the member interacted with the extension recently, e.g. to open a dialog. */
  hasRecentInteraction(): boolean;
  dispose(): void;
}

type ViewProps = Extract<ExtensionHostMessageBody, { type: "view.create" }>["props"];
type ExtensionContext = Omit<Extract<ExtensionHostMessageBody, { type: "context" }>, "type">;
type ResponseResult = Extract<ExtensionHostMessageBody, { type: "response" }>["result"];
type CallbackArguments = Extract<ExtensionHostMessageBody, { type: "callback" }>["args"];

/** One running extension frontend: its sandbox and the host copy of its view tree. */
const createExtensionHost = async (options: ExtensionHostOptions): Promise<ExtensionHost> => {
  const { name, styles, iconStyles, getActions, getAPIContext, onError, ...sandboxOptions } =
    options;
  const tree = createExtensionTree();
  const viewTargets = new Map<string, ExtensionViewTarget>();
  const requests = createRequestHandler({
    extensionID: options.extensionID,
    name,
    sources: options.connectSources,
    getActions: () => getActions?.() ?? null,
    getViewTarget: (viewID) => viewTargets.get(viewID),
    getAPIContext: () => {
      return getAPIContext?.() ?? { apiURL: "", permissions: [], workspaceID: null };
    },
    respond(id, outcome = {}) {
      const { error, result } = outcome;

      sandbox.send({
        type: "response",
        id,
        ...(error ? { error } : result !== undefined && { result: result as ResponseResult })
      });
    }
  });
  // Validated before the sandbox starts; invalid styles fail the extension.
  const sheets = [
    ...(styles ? [createExtensionStyleSheet(styles, name)] : []),
    ...(iconStyles ? [createExtensionStyleSheet(iconStyles, name, "icon")] : [])
  ];
  const sandbox = await createExtensionSandbox({
    ...sandboxOptions,
    onMessage(message) {
      if (message.type === "patch") {
        tree.apply(message.patches);
      } else if (message.type === "error") {
        onError?.(message.message, message.viewID);
      } else if (message.type === "request") {
        void requests.handle(message);
      }
    }
  });

  document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];

  return {
    name,
    tree,
    sources: options.connectSources,
    ready: sandbox.ready,
    createView(entry, props = {}) {
      const viewID = crypto.randomUUID();

      sandbox.send({ type: "view.create", viewID, entry, props });

      return viewID;
    },
    updateView(viewID, props) {
      sandbox.send({ type: "view.update", viewID, props });
    },
    disposeView(viewID) {
      viewTargets.delete(viewID);
      sandbox.send({ type: "view.dispose", viewID });
    },
    setViewTarget(viewID, target) {
      viewTargets.set(viewID, target);
    },
    setContext(context) {
      sandbox.send({ type: "context", ...context });
    },
    setSession(session) {
      sandbox.send({
        type: "session",
        token: session?.token ?? null,
        expiresAt: session?.expiresAt ?? null,
        extensionID: options.extensionID,
        instance: getAPIContext?.().apiURL ?? ""
      });
    },
    invoke(callback, args) {
      requests.recordInteraction();
      sandbox.send({ type: "callback", callback, args });
    },
    recordInteraction() {
      requests.recordInteraction();
    },
    hasRecentInteraction() {
      return requests.hasRecentInteraction();
    },
    dispose() {
      sandbox.dispose();
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => {
        return !sheets.includes(item);
      });
    }
  };
};

export { createExtensionHost };
export type { ExtensionContext, ExtensionHost, ExtensionHostOptions };
