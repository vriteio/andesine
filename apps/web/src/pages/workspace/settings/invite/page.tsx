import { useDelegationPermissions } from "#web/lib/policy/delegation";
import {
  Button,
  Fragment,
  IconButton,
  Input,
  Select,
  Skeleton,
  ToggleGroup,
  Tooltip
} from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createEffect, createSignal, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";

import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { Setting } from "../setting";
import { SettingsSection } from "../settings-section";
import { NewInviteDialog, type InviteDialogDelivery } from "./new-invite-dialog";
import { rolesQuery } from "#web/lib/data";

interface CreatedInvite {
  link: string;
  delivery: "sent" | "manual" | "failed";
}
interface FailedInvite {
  email: string;
  reason: string;
}

type InviteMode = "email" | "link" | "bulk";

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
// Overlaps email sending; the server's workspace lock orders the invites.
const BATCH_SIZE = 5;
// As the server's hourly limit of invitations per workspace.
const MAX_INVITES = 100;

const parseEmails = (text: string): string[] => {
  const emails = text.toLowerCase().split(/[\s,;]+/);

  return [...new Set(emails.filter(Boolean))];
};
const getFailureReason = (error: unknown): string => {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "";

  const hasReadableMessage = code === "FORBIDDEN" || code === "TOO_MANY_REQUESTS";

  if (code === "INVITE_ALREADY_PENDING") return "already invited";
  if (code === "MEMBERSHIP_ALREADY_EXISTS") return "already a member";
  if (hasReadableMessage && error instanceof Error) return error.message;

  return "failed";
};

const InviteSettingsPage: Component = () => {
  const notify = useNotify();
  const { currentWorkspace } = useWorkspace();
  const { canGrantRole } = useDelegationPermissions();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  // In the URL, so the page title follows it.
  const [searchParams, setSearchParams] = useSearchParams<{ type?: string }>();
  const roles = createAsync(() => rolesQuery());
  const [email, setEmail] = createSignal("");
  const [emailText, setEmailText] = createSignal("");
  const [selectedRoleID, setSelectedRoleID] = createSignal("");
  const [inviteLink, setInviteLink] = createSignal("");
  const [delivery, setDelivery] = createSignal<InviteDialogDelivery>("sent");
  const navigateToPeople = () => navigate(`/${params.workspaceID || ""}/settings/people`);
  const mode = (): InviteMode => {
    return searchParams.type === "link" || searchParams.type === "bulk"
      ? searchParams.type
      : "email";
  };
  const setMode = (type: InviteMode) => {
    setSearchParams({ type: type === "email" ? undefined : type }, { replace: true });
  };
  const isPro = () => currentWorkspace()?.subscriptionPlan === "pro";
  const emails = () => {
    return mode() === "bulk"
      ? parseEmails(emailText())
      : [email().trim().toLowerCase()].filter(Boolean);
  };
  // On the Free plan, every member is an admin.
  const availableRoles = () => {
    return (roles() || []).filter((role) => {
      return canGrantRole(role) && (isPro() || role.baseRole === "admin");
    });
  };
  const roleOptions = () => {
    return availableRoles().map((role) => ({ label: role.name, value: role.id }));
  };
  const fillError = () => {
    const needsEmails = mode() !== "link";
    const invalidEmail = emails().find((address) => !EMAIL_PATTERN.test(address));

    if (needsEmails && !emails().length) return "Email address is required";
    if (needsEmails && invalidEmail) return `Enter a valid email address: ${invalidEmail}`;
    if (emails().length > MAX_INVITES) return `Invite up to ${MAX_INVITES} addresses at a time`;
    if (!selectedRoleID()) return "Select a role";
    if (!availableRoles().some((role) => role.id === selectedRoleID())) {
      return "Select a role within your permissions";
    }

    return "";
  };
  const submitLabel = () => {
    if (mode() === "link") return "Create invite link";

    return emails().length > 1 ? `Send ${emails().length} invitations` : "Send invitation";
  };
  const inviteMutation = createMutation(() => ({
    mutationFn: async (input: { emails: Array<string | undefined>; roleID: string }) => {
      const created: CreatedInvite[] = [];
      const failed: FailedInvite[] = [];
      const invite = async (email?: string) => {
        try {
          const result = await client.memberships.invite(
            email ? { email, roleID: input.roleID } : { link: true, roleID: input.roleID }
          );

          created.push({ link: result.inviteLink, delivery: result.emailDelivery });
        } catch (error) {
          console.error(error);
          failed.push({ email: email ?? "", reason: getFailureReason(error) });
        }
      };

      for (let index = 0; index < input.emails.length; index += BATCH_SIZE) {
        await Promise.all(input.emails.slice(index, index + BATCH_SIZE).map(invite));
      }

      return { created, failed };
    },
    onSuccess: async ({ created, failed }) => {
      const sent = created.filter((invite) => invite.delivery === "sent").length;

      if (mode() === "bulk") setEmailText(failed.map((invite) => invite.email).join("\n"));

      await revalidate("invites");

      if (created.length === 1 && !failed.length) {
        setDelivery(mode() === "link" ? "link" : created[0].delivery);
        setInviteLink(created[0].link);
      } else if (created.length) {
        notify({
          type: sent === created.length ? "success" : "error",
          text:
            sent === created.length
              ? `Invitations sent: ${sent}`
              : `Invitations created, but ${created.length - sent} of ${created.length} emails weren't sent. Copy their links from People.`
        });

        if (!failed.length) navigateToPeople();
      }

      // Last, so it's on top of the notifications.
      if (failed.length) {
        notify({
          type: "error",
          text:
            mode() === "link"
              ? `Couldn't create the link: ${failed[0].reason}`
              : `Couldn't invite ${failed
                  .map((invite) => `${invite.email} (${invite.reason})`)
                  .join(", ")}`
        });
      }
    }
  }));
  const submit = () => {
    if (fillError()) return;

    inviteMutation.mutate({
      emails: mode() === "link" ? [undefined] : emails(),
      roleID: selectedRoleID()
    });
  };

  createEffect(() => {
    const options = availableRoles();

    if (!options.some((role) => role.id === selectedRoleID())) {
      setSelectedRoleID(options[0]?.id || "");
    }
  });

  return (
    <>
      <NewInviteDialog
        link={inviteLink()}
        delivery={delivery()}
        onClose={() => {
          setInviteLink("");
          navigateToPeople();
        }}
      />
      <div class="flex min-w-0 flex-col">
        <SettingsSection label="Invitation details">
          <Setting
            label="Invitation type"
            description={
              {
                email: "Send one invitation by email",
                link: "Create a link one person can use",
                bulk: "Send an invitation to each address"
              }[mode()]
            }
            fade={false}
          >
            <ToggleGroup
              wrapperClass="w-full max-w-md"
              itemClass="flex-1"
              disabled={inviteMutation.isPending}
              value={mode()}
              setValue={(value) => setMode(value as InviteMode)}
              options={[
                { value: "email", label: "Email" },
                { value: "link", label: "Link" },
                { value: "bulk", label: "Bulk" }
              ]}
            />
          </Setting>
          <Show when={mode() === "email"}>
            <Setting
              label="Email address"
              description="The teammate who should receive this invite"
              fade={false}
            >
              <Input
                type="email"
                autocomplete="email"
                placeholder="colleague@example.com"
                value={email()}
                setValue={setEmail}
                class="w-full max-w-md"
                onEnter={submit}
              />
            </Setting>
          </Show>
          <Show when={mode() === "bulk"}>
            <Setting
              label="Email addresses"
              description="Separate with commas or new lines"
              fade={false}
            >
              <textarea
                class="w-full max-w-md resize-y rounded-lg bg-white scrollbar-white px-2 py-1 text-[16px] text-gray-700 shadow-md shadow-gray-900/8 outline outline-1 -outline-offset-1 outline-gray-200 ring-offset-1 placeholder:opacity-50 focus:bg-gray-100 focus:outline-1 disabled:shadow-none md:text-sm"
                rows={4}
                autocomplete="email"
                placeholder={"colleague@example.com\nteammate@example.com"}
                disabled={inviteMutation.isPending}
                value={emailText()}
                onInput={(event) => setEmailText(event.currentTarget.value)}
              />
            </Setting>
          </Show>
          <Setting
            label="Role"
            description={
              isPro()
                ? "Role assigned when the invitation is accepted"
                : "On the Free plan, every member is an admin"
            }
            fade={false}
          >
            <Select
              class="w-full max-w-md"
              disabled={inviteMutation.isPending || roleOptions().length === 0}
              options={roleOptions()}
              placeholder="Select a role"
              value={selectedRoleID()}
              setValue={setSelectedRoleID}
            />
          </Setting>
        </SettingsSection>
        <div class="flex h-4 w-full items-center justify-center">
          <div class="h-px flex-1 bg-gray-200" />
        </div>
        <Suspense fallback={<Skeleton class="h-7 w-full rounded-lg" />}>
          <div class="flex items-center justify-end gap-2">
            <Tooltip content="Go back">
              <IconButton
                icon="i-lucide:chevron-left"
                onClick={navigateToPeople}
                disabled={inviteMutation.isPending}
              />
            </Tooltip>
            <Dynamic
              component={fillError() ? Tooltip : Fragment}
              content={fillError()}
              wrapperClass="flex-1"
            >
              <Button
                class="flex w-full items-center justify-center gap-1"
                disabled={Boolean(fillError())}
                loading={inviteMutation.isPending}
                onClick={submit}
              >
                {submitLabel()}
              </Button>
            </Dynamic>
          </div>
        </Suspense>
      </div>
    </>
  );
};

export default InviteSettingsPage;
