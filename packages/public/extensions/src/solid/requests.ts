import type { JSONValue, RequestError, RequestErrorCode, RequestMethod } from "./protocol";

interface PendingRequest {
  resolve(result: JSONValue | undefined): void;
  reject(error: ExtensionRequestError): void;
}

type RequestSender = (id: number, method: RequestMethod, params: JSONValue) => void;

const pending = new Map<number, PendingRequest>();

let nextID = 1;
let sendRequest: RequestSender | null = null;

/** A host request failed; `code` says why, for example `user_interaction_required`. */
class ExtensionRequestError extends Error {
  constructor(
    readonly code: RequestErrorCode,
    message: string
  ) {
    super(message);
  }
}

const setRequestSender = (sender: RequestSender): void => {
  sendRequest = sender;
};
const request = (method: RequestMethod, params: JSONValue): Promise<JSONValue | undefined> => {
  if (!sendRequest) {
    return Promise.reject(new ExtensionRequestError("unavailable", "The extension is not running"));
  }

  const id = nextID++;
  const send = sendRequest;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send(id, method, params);
  });
};
const settleRequest = (id: number, result: JSONValue | undefined, error?: RequestError): void => {
  const request = pending.get(id);

  if (!request) return;

  pending.delete(id);

  if (error) {
    request.reject(new ExtensionRequestError(error.code, error.message));
  } else {
    request.resolve(result);
  }
};

export { ExtensionRequestError, request, setRequestSender, settleRequest };
