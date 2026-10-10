import { createClient, type AndesineClient, type ClientOptions } from "./client";
import { AndesineAPIError } from "./error";
import { createExtensionSigner, type ExtensionPrivateKey } from "./extensions/jwt";

interface ExtensionBackendOptions {
  /** The extension's registry name, e.g. `acme/publish`. */
  name: string;
  /** Private Ed25519 or P-256 JWK (string or object) with the registry `kid`; keep it secret. */
  privateKey: string | ExtensionPrivateKey;
  /** API URLs of the trusted Andesine instances, e.g. `https://api.andesine.app`. */
  trustedInstances: string[];
  /** Options for the API clients; the backend sets the base URL and the credential. */
  client?: Omit<ClientOptions, "baseURL" | "apiKey" | "accessToken">;
}
interface ExtensionSessionContext extends VerifiedSession {
  /** The installation's `ext_` ID. */
  extensionID: string;
  /** The instance API URL. */
  instance: string;
  /** An API client for the installation, with the extension's permissions. */
  client: AndesineClient;
}
interface ExtensionDeliveryContext extends ReceivedDelivery {
  /** The installation's `ext_` ID. */
  extensionID: string;
  /** The instance API URL. */
  instance: string;
  /** An API client for the installation, with the extension's permissions. */
  client: AndesineClient;
}
interface ExtensionBackend {
  /**
   * API client for an installation; without `extensionID`, it can only list installations.
   * @throws TypeError if the instance is not trusted.
   */
  createClient(instance: string, extensionID?: string): AndesineClient;
  /**
   * Verifies the session headers that the frontend's `backend.fetch` sends.
   * @throws ExtensionSessionError for missing headers, an untrusted instance, or an invalid token.
   * @throws AndesineAPIError for other API failures.
   */
  verifySession(headers: HeaderSource): Promise<ExtensionSessionContext>;
  /**
   * Confirms a webhook body by fetching its delivery; respond with 2xx once handled, or it retries.
   * @throws ExtensionNotificationError for an invalid body, an untrusted instance, or no delivery.
   * @throws AndesineAPIError for other API failures.
   */
  receive(body: unknown): Promise<ExtensionDeliveryContext>;
}

type VerifiedSession = Awaited<ReturnType<AndesineClient["extensions"]["verifySession"]>>;
type ReceivedDelivery = Awaited<ReturnType<AndesineClient["extensions"]["getSelfDelivery"]>>;
type HeaderSource = Headers | Record<string, string | string[] | undefined>;
type ExtensionSessionErrorCode = "MISSING_SESSION" | "UNTRUSTED_INSTANCE" | "INVALID_SESSION";
type ExtensionNotificationErrorCode =
  "INVALID_NOTIFICATION" | "UNTRUSTED_INSTANCE" | "UNKNOWN_DELIVERY";

class ExtensionSessionError extends Error {
  constructor(readonly code: ExtensionSessionErrorCode) {
    super(`Extension session verification failed: ${code}`);
  }
}

class ExtensionNotificationError extends Error {
  constructor(readonly code: ExtensionNotificationErrorCode) {
    super(`Extension notification failed: ${code}`);
  }
}

const isRejection = (error: unknown): boolean => {
  return error instanceof AndesineAPIError && [401, 403, 404].includes(error.status);
};
const parseJSON = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
const getString = (value: object, key: string): string | null => {
  const field = (value as Record<string, unknown>)[key];

  return typeof field === "string" && field ? field : null;
};
const normalizeInstance = (instance: string): string | null => {
  try {
    const url = new URL(instance);
    const isHTTP = url.protocol === "https:" || url.protocol === "http:";

    return isHTTP ? `${url.origin}${url.pathname}`.replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
};
const getHeader = (headers: HeaderSource, name: string): string | null => {
  if (headers instanceof Headers) return headers.get(name);

  const value = headers[name.toLowerCase()];

  return (Array.isArray(value) ? value[0] : value) ?? null;
};
/**
 * Creates the backend helpers, which sign and cache extension JWTs for trusted instances only.
 * @example
 * const extension = createExtensionBackend({
 *   name: "acme/publish",
 *   privateKey: process.env.ANDESINE_EXTENSION_KEY!,
 *   trustedInstances: ["https://api.andesine.app"]
 * });
 * const session = await extension.verifySession(request.headers);
 */
const createExtensionBackend = (options: ExtensionBackendOptions): ExtensionBackend => {
  const signer = createExtensionSigner(options.name, options.privateKey);
  const trusted = new Set(options.trustedInstances.map(normalizeInstance));
  const fetcher = options.client?.fetch ?? globalThis.fetch;
  const getTrustedInstance = (instance: string): string | null => {
    const normalized = normalizeInstance(instance);

    return normalized && trusted.has(normalized) ? normalized : null;
  };
  const createBackendClient = (instance: string, extensionID?: string): AndesineClient => {
    const audience = getTrustedInstance(instance);

    if (!audience) throw new TypeError("The instance is not trusted");

    return createClient({
      ...options.client,
      baseURL: audience,
      apiKey: "",
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const token = await signer.sign({ audience, subject: extensionID ?? null });

        request.headers.set("Authorization", `Bearer ${token}`);

        return fetcher(request);
      }
    });
  };

  return {
    createClient: createBackendClient,
    async verifySession(headers) {
      const token = /^Bearer\s+(\S+)$/i.exec(getHeader(headers, "Authorization") ?? "")?.[1];
      const extensionID = getHeader(headers, "Andesine-Extension");
      const instance = getHeader(headers, "Andesine-Instance");

      if (!token || !extensionID || !instance) throw new ExtensionSessionError("MISSING_SESSION");

      const audience = getTrustedInstance(instance);

      if (!audience) throw new ExtensionSessionError("UNTRUSTED_INSTANCE");

      const client = createBackendClient(audience, extensionID);

      try {
        const session = await client.extensions.verifySession({ token });

        return { ...session, extensionID, instance: audience, client };
      } catch (error) {
        if (isRejection(error)) throw new ExtensionSessionError("INVALID_SESSION");

        throw error;
      }
    },
    async receive(body) {
      const notification = typeof body === "string" ? parseJSON(body) : body;
      const isObject = typeof notification === "object" && notification !== null;
      const deliveryID = isObject ? getString(notification, "deliveryID") : null;
      const extensionID = isObject ? getString(notification, "extensionID") : null;
      const instance = isObject ? getString(notification, "instance") : null;

      if (!deliveryID || !extensionID || !instance) {
        throw new ExtensionNotificationError("INVALID_NOTIFICATION");
      }

      const audience = getTrustedInstance(instance);

      if (!audience) throw new ExtensionNotificationError("UNTRUSTED_INSTANCE");

      const client = createBackendClient(audience, extensionID);

      try {
        const delivery = await client.extensions.getSelfDelivery({ deliveryID });

        return { ...delivery, extensionID, instance: audience, client };
      } catch (error) {
        if (isRejection(error)) throw new ExtensionNotificationError("UNKNOWN_DELIVERY");

        throw error;
      }
    }
  };
};

export { createExtensionBackend, ExtensionNotificationError, ExtensionSessionError };
export type {
  ExtensionBackend,
  ExtensionBackendOptions,
  ExtensionDeliveryContext,
  ExtensionNotificationErrorCode,
  ExtensionPrivateKey,
  ExtensionSessionContext,
  ExtensionSessionErrorCode
};
