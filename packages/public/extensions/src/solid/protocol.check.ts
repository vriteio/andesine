// Type-only check (not bundled): local protocol types must equal the contracts.
import type {
  ExtensionEnvelope,
  ExtensionHostMessageBody,
  ExtensionPatch,
  ExtensionRequestErrorCode,
  ExtensionRequestMethod,
  ExtensionWorkerMessageBody
} from "@andesine/contracts/extensions";
import type {
  Envelope,
  HostMessageBody,
  RequestErrorCode,
  RequestMethod,
  ViewPatch,
  WorkerMessageBody
} from "./protocol";

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;
type ProtocolChecks = [
  Expect<Same<Envelope, ExtensionEnvelope>>,
  Expect<Same<ViewPatch, ExtensionPatch>>,
  Expect<Same<HostMessageBody, ExtensionHostMessageBody>>,
  Expect<Same<WorkerMessageBody, ExtensionWorkerMessageBody>>,
  Expect<Same<RequestMethod, ExtensionRequestMethod>>,
  Expect<Same<RequestErrorCode, ExtensionRequestErrorCode>>
];

export type { ProtocolChecks };
