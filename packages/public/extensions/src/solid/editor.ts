import { createContext, useContext } from "solid-js";
import type { JSONValue } from "./protocol";
import { request } from "./requests";

/** Editor JSON block, e.g. `{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }`. */
interface ContentNode {
  type: string;
  attrs?: Record<string, JSONValue>;
  content?: ContentNode[];
  marks?: Array<{ type: string; attrs?: Record<string, JSONValue> }>;
  text?: string;
}
interface ViewEditor {
  /** Block action views: replaces the blocks the action was opened for. */
  replace(content: ContentNode[]): Promise<void>;
  /** Block action views: inserts blocks after those the action was opened for. */
  insertAfter(content: ContentNode[]): Promise<void>;
  /** Element views: updates the element's props; call it from a user interaction. */
  setElementProps(props: Record<string, JSONValue>): Promise<void>;
  /** Block action views: closes the view. */
  close(): Promise<void>;
}

const ViewContext = createContext<string>();

/** Edits the document as the member; invalid edits reject with `ExtensionRequestError`. */
const useEditor = (): ViewEditor => {
  const viewID = useContext(ViewContext) ?? "";
  // Content built from view props holds store proxies, which `postMessage` cannot clone.
  const asJSON = (value: unknown) => JSON.parse(JSON.stringify(value)) as JSONValue;

  return {
    replace: async (content) => {
      await request("editor.replace", { viewID, content: asJSON(content) });
    },
    insertAfter: async (content) => {
      await request("editor.insertAfter", { viewID, content: asJSON(content) });
    },
    setElementProps: async (props) => {
      await request("editor.setElementProps", {
        viewID,
        props: asJSON(props) as Record<string, JSONValue>
      });
    },
    close: async () => {
      await request("view.close", { viewID });
    }
  };
};

export { ViewContext, useEditor };
export type { ContentNode, ViewEditor };
