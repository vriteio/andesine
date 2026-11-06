import { Fragment, IconButton, Tooltip } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { type Component, Show, Suspense, useTransition } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useWorkspace } from "#web/context/workspace";
import { TreeSkeleton } from "#web/components/tree";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { InviteList } from "./invite-list";
import { WorkspaceMemberList } from "./member-list";
import { FREE_MEMBER_LIMIT, invitesQuery, membershipsQuery, rolesQuery } from "#web/lib/data";
import type { InvitationSubsectionProps } from "./types";

const InvitationsSubsection: Component<InvitationSubsectionProps> = (props) => {
  const [invitesRefreshing, startInvitesRefresh] = useTransition();
  const refreshInvites = (onRevalidated = () => {}) => {
    void startInvitesRefresh(() => {
      void (async () => {
        await revalidate(invitesQuery.key);
        onRevalidated();
      })();
    });
  };
  return (
    <Show when={props.invites.length > 0}>
      <Setting
        label="Invitations"
        description="Invitations remain here until they are accepted or revoked"
        fade={false}
      />
      <div class="relative flex w-full flex-col">
        <Suspense
          fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={2} size="medium" />}
        >
          <InviteList
            invites={props.invites || []}
            roles={props.roles || []}
            invitesRefreshing={invitesRefreshing()}
            refreshInvites={refreshInvites}
          />
        </Suspense>
      </div>
    </Show>
  );
};

const MembersSection: Component = () => {
  const { currentWorkspace, hasPermission } = useWorkspace();
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  const members = createAsync(() => membershipsQuery());
  const canManage = () => hasPermission("memberships");
  const isPro = () => currentWorkspace()?.subscriptionPlan === "pro";
  const canManageProFeatures = () => canManage() && isPro();
  const invites = createAsync(async () => (canManage() ? invitesQuery() : []));
  const roles = createAsync(() => rolesQuery());
  const inviteLimitReason = () => {
    const used = (members()?.length ?? 0) + (invites()?.length ?? 0);

    if (isPro() || used < FREE_MEMBER_LIMIT) return "";

    return `The Free plan has up to ${FREE_MEMBER_LIMIT} members, including pending invites`;
  };
  const [membersRefreshing, startMembersRefresh] = useTransition();
  const refreshMembers = (onRevalidated = () => {}) => {
    void startMembersRefresh(() => {
      void (async () => {
        await revalidate(membershipsQuery.key);
        onRevalidated();
      })();
    });
  };

  return (
    <SettingsSection label="Members">
      <div class="flex flex-col">
        <Setting
          label="Workspace members"
          description="Manage people who have access to this workspace"
          fade={false}
        >
          <Show when={canManage()}>
            <Dynamic
              component={inviteLimitReason() ? Tooltip : Fragment}
              content={inviteLimitReason()}
            >
              <IconButton
                label={() => <span class="px-1">Invite member</span>}
                class="flex-row-reverse pr-1"
                disabled={Boolean(inviteLimitReason())}
                onClick={() => navigate(`/${params.workspaceID || ""}/settings/invite`)}
                iconProps={{ class: "h-4 w-4" }}
                icon="i-lucide:plus"
              />
            </Dynamic>
          </Show>
        </Setting>
        <div class="relative flex w-full flex-col">
          <Suspense
            fallback={<TreeSkeleton fullWidth itemHeight="2rem" rowCount={2} size="medium" />}
          >
            <WorkspaceMemberList
              members={members() || []}
              roles={roles() || []}
              canManage={canManage()}
              canManageRoles={canManageProFeatures()}
              disabledNonAdmins={!isPro()}
              currentUserID={currentWorkspace()?.userID}
              membersRefreshing={membersRefreshing()}
              refreshMembers={refreshMembers}
            />
          </Suspense>
        </div>
        <Show when={canManage()}>
          <Suspense>
            <InvitationsSubsection invites={invites() || []} roles={roles() || []} />
          </Suspense>
        </Show>
      </div>
    </SettingsSection>
  );
};

export { MembersSection };
