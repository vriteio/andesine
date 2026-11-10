import * as z from "zod";

const credentialsSchema = z.object({
  version: z.literal(1),
  baseURL: z.string(),
  accountID: z.string(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().finite(),
  refreshPending: z.boolean().default(false)
});
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.string().refine((value) => value.toLowerCase() === "bearer"),
  expires_in: z.number().int().positive(),
  scope: z.string().optional()
});
const deviceResponseSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/),
  verification_uri: z.url(),
  verification_uri_complete: z.url().optional(),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive().default(5)
});

type Credentials = z.output<typeof credentialsSchema>;
type TokenResponse = z.output<typeof tokenResponseSchema>;
type DeviceResponse = z.output<typeof deviceResponseSchema>;
type StorageKind = "keyring" | "file";

export { credentialsSchema, tokenResponseSchema, deviceResponseSchema };
export type { Credentials, TokenResponse, DeviceResponse, StorageKind };
