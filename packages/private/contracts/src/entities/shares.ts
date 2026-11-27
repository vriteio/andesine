import { id } from "../primitives/id";
import * as z from "zod";

const shareKindType = z
  .enum(["link", "email"])
  .describe("link: anyone with the link; email: one person, who signs in with the email");
const shareAccessType = z
  .enum(["view", "comment"])
  .describe("view: read the entry; comment: also comment and suggest changes");
const visitorNameType = z.string().trim().min(1).max(50);
const visitorType = z.object({
  id: id().describe("ID of the visitor"),
  name: z.string().nullable().describe("Name of the visitor, or null for an anonymous visitor")
});
const shareType = z.object({
  id: id().describe("ID of the share"),
  entryID: id().describe("ID of the shared entry"),
  kind: shareKindType,
  access: shareAccessType,
  token: z.string().nullable().describe("Token of the share link; null for email shares"),
  email: z.email().nullable().describe("Email address of the person; null for links"),
  createdByID: id().nullable().describe("Membership that created the share"),
  expiresAt: z.iso.datetime().nullable().describe("When the share expires, or null for never"),
  createdAt: z.iso.datetime().describe("When the share was created")
});
const sharingPolicyType = z.object({
  linkSharing: z.boolean().describe("Whether links work; off pauses them"),
  emailSharing: z.boolean().describe("Whether email shares work; off pauses them"),
  maxExpiryDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .nullable()
    .describe("Days after which new or changed shares expire at the latest; null for no limit")
});
type Visitor = z.infer<typeof visitorType>;
type Share = z.infer<typeof shareType>;
type ShareAccess = z.infer<typeof shareAccessType>;
type ShareKind = z.infer<typeof shareKindType>;
type SharingPolicy = z.infer<typeof sharingPolicyType>;
export {
  visitorNameType,
  visitorType,
  shareAccessType,
  shareKindType,
  shareType,
  sharingPolicyType
};
export type { Visitor, Share, ShareAccess, ShareKind, SharingPolicy };
