import { extensionNameType, type ExtensionBackendKey } from "@andesine/contracts/extensions";
import { config } from "#backend/lib/config";
import { ORPCError } from "@orpc/server";
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose";

interface DecodedExtensionToken {
  kid: string;
  name: string;
  /** The raw `sub` claim; app-level tokens have none. */
  subject: unknown;
}

const MAX_TOKEN_AGE_SECONDS = 300;
const CLOCK_TOLERANCE_SECONDS = 30;

const apiURL = new URL(config.PUBLIC_API_URL);
// The SDK signs the instance URL as its origin and path without trailing slashes.
const audiences = [
  ...new Set([config.PUBLIC_API_URL, `${apiURL.origin}${apiURL.pathname}`.replace(/\/+$/, "")])
];

const unauthorized = (): ORPCError<"UNAUTHORIZED", unknown> => {
  return new ORPCError("UNAUTHORIZED", { message: "The extension token is not valid" });
};
const isExtensionToken = (token: string): boolean => token.split(".").length === 3;
/** Reads the unverified header and claims; verify the signature before trusting them. */
const decodeExtensionToken = (token: string): DecodedExtensionToken => {
  try {
    const header = decodeProtectedHeader(token);
    const claims = decodeJwt(token);
    const name = extensionNameType.safeParse(claims.iss);

    if (!name.success || typeof header.kid !== "string") throw unauthorized();

    return { kid: header.kid, name: name.data, subject: claims.sub };
  } catch {
    throw unauthorized();
  }
};
/** Lifetime and age are at most 5 minutes; app-level tokens must have no subject. */
const verifyExtensionToken = async (
  token: string,
  key: ExtensionBackendKey,
  expected: { name: string; subject: string | null }
): Promise<void> => {
  try {
    const { payload } = await jwtVerify(token, await importJWK(key, key.alg), {
      algorithms: [key.alg],
      audience: audiences,
      issuer: expected.name,
      ...(expected.subject !== null && { subject: expected.subject }),
      maxTokenAge: MAX_TOKEN_AGE_SECONDS,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ["iat", "exp"]
    });
    const isValid =
      payload.exp! - payload.iat! <= MAX_TOKEN_AGE_SECONDS &&
      (expected.subject !== null || payload.sub === undefined);

    if (!isValid) throw unauthorized();
  } catch {
    throw unauthorized();
  }
};

export { decodeExtensionToken, isExtensionToken, unauthorized, verifyExtensionToken };
export type { DecodedExtensionToken };
