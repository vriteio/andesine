interface ExtensionPrivateKey extends JsonWebKey {
  kid?: string;
}
interface ExtensionTokenClaims {
  /** The instance API URL. */
  audience: string;
  /** The installation's `ext_` ID; null for app-level tokens. */
  subject: string | null;
}
interface ExtensionSigner {
  sign(claims: ExtensionTokenClaims): Promise<string>;
}
interface CachedToken {
  token: string;
  expiresAt: number;
}

// Andesine accepts tokens up to 300 seconds old; cached tokens renew a minute before that.
const TOKEN_LIFETIME = 300;
const RENEWAL_MARGIN = 60;
const MAX_CACHED_TOKENS = 1_000;
const ALGORITHMS = {
  "Ed25519": {
    alg: "EdDSA",
    importParams: { name: "Ed25519" },
    signParams: { name: "Ed25519" }
  },
  "P-256": {
    alg: "ES256",
    importParams: { name: "ECDSA", namedCurve: "P-256" },
    signParams: { name: "ECDSA", hash: "SHA-256" }
  }
} as const;

const encodeBase64URL = (bytes: Uint8Array): string => {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};
const encodeJSON = (value: object): string => {
  return encodeBase64URL(new TextEncoder().encode(JSON.stringify(value)));
};
// Errors never include the key, which can come from an environment variable.
const parsePrivateKey = (input: string | ExtensionPrivateKey): ExtensionPrivateKey => {
  if (typeof input !== "string") return input;

  try {
    return JSON.parse(input) as ExtensionPrivateKey;
  } catch {
    throw new TypeError("privateKey must be a JSON Web Key");
  }
};
/** Signs extension JWTs with a private Ed25519 or P-256 JWK; caches them per audience/subject. */
const createExtensionSigner = (
  name: string,
  privateKey: string | ExtensionPrivateKey
): ExtensionSigner => {
  const jwk = parsePrivateKey(privateKey);
  const algorithm = ALGORITHMS[jwk.crv as keyof typeof ALGORITHMS];
  const cache = new Map<string, CachedToken>();

  let key: Promise<CryptoKey> | null = null;

  if (!algorithm || !jwk.d || !jwk.kid) {
    throw new TypeError("privateKey must be a private Ed25519 or P-256 JWK with a kid");
  }

  // Imported on first use, so an invalid key fails the first request, not module loading.
  const getKey = (): Promise<CryptoKey> => {
    key ??= crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d },
      algorithm.importParams,
      false,
      ["sign"]
    );

    return key;
  };

  return {
    async sign({ audience, subject }) {
      const now = Math.floor(Date.now() / 1000);
      const cacheKey = `${audience} ${subject ?? ""}`;
      const cached = cache.get(cacheKey);

      if (cached && cached.expiresAt - RENEWAL_MARGIN > now) return cached.token;

      const header = encodeJSON({ alg: algorithm.alg, kid: jwk.kid, typ: "JWT" });
      const payload = encodeJSON({
        iss: name,
        ...(subject && { sub: subject }),
        aud: audience,
        iat: now,
        exp: now + TOKEN_LIFETIME
      });
      const signature = await crypto.subtle.sign(
        algorithm.signParams,
        await getKey(),
        new TextEncoder().encode(`${header}.${payload}`)
      );
      const token = `${header}.${payload}.${encodeBase64URL(new Uint8Array(signature))}`;

      if (cache.size >= MAX_CACHED_TOKENS) cache.clear();

      cache.set(cacheKey, { token, expiresAt: now + TOKEN_LIFETIME });

      return token;
    }
  };
};

export { createExtensionSigner };
export type { ExtensionPrivateKey, ExtensionSigner };
