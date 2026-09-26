import * as z from "zod";

type ApplicationEncryptionKey = z.infer<typeof applicationEncryptionKeyType>;

const applicationEncryptionKeyType = z.strictObject({
  id: z.string().regex(/^[A-Za-z\d_-]{1,64}$/),
  key: z
    .string()
    .regex(/^[A-Za-z\d+/]{43}=$/)
    .refine((value) => Buffer.from(value, "base64").toString("base64") === value, {
      message: "Encryption keys must be canonical base64 for 32 random bytes"
    })
});
const applicationEncryptionKeysType = z
  .array(applicationEncryptionKeyType)
  .min(1)
  .max(8)
  .refine((keys) => new Set(keys.map(({ id }) => id)).size === keys.length, {
    message: "Encryption key IDs must be unique"
  })
  .refine((keys) => new Set(keys.map(({ key }) => key)).size === keys.length, {
    message: "Encryption key values must be unique"
  });
const encryptionConfigSchema = z.object({
  ENCRYPTION_KEYS: z
    .preprocess((value) => {
      if (typeof value !== "string") return value;

      try {
        return JSON.parse(value);
      } catch {
        // Do not expose JSON parse errors, which can contain secret input.
        return null;
      }
    }, applicationEncryptionKeysType)
    .describe("JSON encryption key list; first key encrypts, all listed keys can decrypt")
});

export { applicationEncryptionKeysType, encryptionConfigSchema };
export type { ApplicationEncryptionKey };
