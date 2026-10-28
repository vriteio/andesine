import { type MemberDetails, listMembers } from "./list";
import { type UserMembership, listUserMemberships } from "./list-for-user";
import { updateMember } from "./update";
import { removeMember } from "./remove";
import { inviteMember } from "./invite";
import { acceptInvite } from "./accept-invite";
import { type InviteDetails, listInvites } from "./list-invites";
import { revokeInvite } from "./revoke-invite";
import { resendInvite } from "./resend-invite";
import { setCurrentEntry } from "./set-current-entry";

const Memberships = {
  list: listMembers,
  listForUser: listUserMemberships,
  update: updateMember,
  remove: removeMember,
  invite: inviteMember,
  acceptInvite,
  listInvites,
  setCurrentEntry,
  revokeInvite,
  resendInvite
};

export { Memberships };
export type { MemberDetails, InviteDetails, UserMembership };
