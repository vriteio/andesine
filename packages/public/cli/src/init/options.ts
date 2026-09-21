import type { GlobalOptions } from "../config/resolve";
import type { StorageKind } from "../auth/schema";
import type { TypeOptions } from "../types/options";

interface InitOptions extends GlobalOptions, TypeOptions {
  generate?: boolean;
  yes?: boolean;
  browser: boolean;
  credentialStore?: StorageKind;
}

export type { InitOptions };
