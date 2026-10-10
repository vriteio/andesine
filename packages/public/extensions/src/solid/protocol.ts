// Contract type copies keep private packages out of declarations; see `protocol.check.ts`.
interface Envelope {
  protocol: 1;
  generation: number;
  sequence: number;
}
interface RequestError {
  code: RequestErrorCode;
  message: string;
}

type RequestMethod =
  | "host.copyText"
  | "host.downloadFile"
  | "host.openURL"
  | "host.notify"
  | "editor.replace"
  | "editor.insertAfter"
  | "editor.setElementProps"
  | "view.close"
  | "storage.get"
  | "storage.set"
  | "storage.delete"
  | "storage.list"
  | "api.fetch";
type RequestErrorCode =
  | "invalid_request"
  | "forbidden"
  | "too_many_requests"
  | "user_interaction_required"
  | "unavailable"
  | "failed";
type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
type ViewPatch =
  | { op: "root"; id: number; viewID: string }
  | { op: "create"; id: number; component: string }
  | { op: "text"; id: number; value: string }
  | { op: "setText"; id: number; value: string }
  | { op: "insert"; parent: number; id: number; before: number | null }
  | { op: "remove"; id: number }
  | { op: "prop"; id: number; name: string; value: JSONValue }
  | { op: "callback"; id: number; name: string; callback: number }
  | { op: "unset"; id: number; name: string };
type HostMessageBody =
  | { type: "heartbeat"; id: number }
  | { type: "dispose" }
  | { type: "view.create"; viewID: string; entry: string; props: Record<string, JSONValue> }
  | { type: "view.update"; viewID: string; props: Record<string, JSONValue> }
  | { type: "view.dispose"; viewID: string }
  | { type: "callback"; callback: number; args: JSONValue[] }
  | {
      type: "context";
      permissions: string[];
      backend: string | null;
      configuration: Record<string, JSONValue>;
    }
  | {
      type: "session";
      token: string | null;
      expiresAt: string | null;
      extensionID: string;
      instance: string;
    }
  | { type: "response"; id: number; result?: JSONValue; error?: RequestError };
type WorkerMessageBody =
  | { type: "ready" }
  | { type: "heartbeat"; id: number }
  | { type: "error"; viewID?: string; message: string }
  | { type: "patch"; patches: ViewPatch[] }
  | { type: "request"; id: number; method: RequestMethod; params: JSONValue };

export type {
  Envelope,
  RequestError,
  RequestMethod,
  RequestErrorCode,
  JSONValue,
  ViewPatch,
  HostMessageBody,
  WorkerMessageBody
};
