import * as z from "zod";

type DeviceRequestState = z.infer<typeof deviceRequestStateType>;
const deviceUserCodeType = z
  .string()
  .max(32)
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .pipe(
    z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/, "Enter the eight-character code from your terminal")
  );
const deviceRequestStateType = z.enum([
  "pending",
  "approved",
  "denied",
  "expired",
  "unavailable",
  "processed",
  "account-mismatch",
  "unsupported"
]);
export { deviceUserCodeType, deviceRequestStateType };
export type { DeviceRequestState };
