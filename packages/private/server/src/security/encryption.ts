import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import * as z from "zod";
import { applicationEncryptionKeysType, type ApplicationEncryptionKey } from "./encryption-config";

interface SecretEncryption {
  encrypt: (plaintext: Uint8Array, context: string) => Buffer;
  decrypt: (ciphertext: Uint8Array, context: string) => Buffer;
}

const envelopeType = z.strictObject({
  version: z.literal(1),
  keyID: z.string().regex(/^[A-Za-z\d_-]{1,64}$/),
  iv: z.string(),
  tag: z.string(),
  data: z.string()
});
const decodeBase64 = (value: string): Buffer => {
  const decoded = Buffer.from(value, "base64");

  if (decoded.toString("base64") !== value) throw new Error("Invalid ciphertext encoding");

  return decoded;
};
// Context must identify the purpose and owner of a secret. It is authenticated,
// but not stored in the envelope, so copying ciphertext to another owner fails.
const createSecretEncryption = (input: ApplicationEncryptionKey[]): SecretEncryption => {
  const result = applicationEncryptionKeysType.safeParse(input);

  if (!result.success) throw new Error("Invalid application encryption key configuration");

  const keys = new Map(result.data.map(({ id, key }) => [id, Buffer.from(key, "base64")]));
  const activeID = result.data[0]!.id;
  const associatedData = (keyID: string, context: string): Buffer => {
    if (!context) throw new Error("Secret encryption requires an owner context");

    return Buffer.from(JSON.stringify(["andesine-secret", 1, keyID, context]), "utf8");
  };
  const encrypt = (plaintext: Uint8Array, context: string): Buffer => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", keys.get(activeID)!, iv, { authTagLength: 16 });

    cipher.setAAD(associatedData(activeID, context));

    const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return Buffer.from(
      JSON.stringify({
        version: 1,
        keyID: activeID,
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: data.toString("base64")
      }),
      "utf8"
    );
  };
  const decrypt = (ciphertext: Uint8Array, context: string): Buffer => {
    try {
      const envelope = envelopeType.parse(JSON.parse(Buffer.from(ciphertext).toString("utf8")));
      const key = keys.get(envelope.keyID);
      const iv = decodeBase64(envelope.iv);
      const tag = decodeBase64(envelope.tag);
      const data = decodeBase64(envelope.data);

      if (!key || iv.length !== 12 || tag.length !== 16) throw new Error("Invalid ciphertext");

      const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });

      decipher.setAAD(associatedData(envelope.keyID, context));
      decipher.setAuthTag(tag);

      return Buffer.concat([decipher.update(data), decipher.final()]);
    } catch {
      // Neither ciphertext, plaintext, configuration, nor parser errors belong in logs.
      throw new Error("Unable to decrypt stored secret");
    }
  };

  return { encrypt, decrypt };
};

export { createSecretEncryption };
export type { SecretEncryption };
