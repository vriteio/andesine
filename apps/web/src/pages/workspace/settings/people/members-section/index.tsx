import { IconButton } from "@andesine/components";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import { type Component, Show, Suspense, useTransition } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { TreeSkeleton } from "#web/components/tree";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { InviteList } from "./invite-list";
import { WorkspaceMemberList } from "./member-list";
import { invitesQuery, membershipsQuery, rolesQuery } from "#web/lib/data";
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
  const canManageProFeatures = () => {
    return canManage() && currentWorkspace()?.subscriptionPlan === "pro";
  };
  const invites = createAsync(async () => (canManageProFeatures() ? invitesQuery() : []));
  const roles = createAsync(() => rolesQuery());
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
          <Show when={canManageProFeatures()}>
            <IconButton
              label={() => <span class="px-1">Invite member</span>}
              class="flex-row-reverse pr-1"
              onClick={() => navigate(`/${params.workspaceID || ""}/settings/invite`)}
              iconProps={{ class: "h-4 w-4" }}
              icon="i-lucide:plus"
              size="small"
              color="contrast"
              variant="outlined"
              text="soft"
            />
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
              disabledNonAdmins={currentWorkspace()?.subscriptionPlan !== "pro"}
              currentUserID={currentWorkspace()?.userID}
              membersRefreshing={membersRefreshing()}
              refreshMembers={refreshMembers}
            />
          </Suspense>
        </div>
        <Show when={canManageProFeatures()}>
          <Suspense>
            <InvitationsSubsection invites={invites() || []} roles={roles() || []} />
          </Suspense>
        </Show>
      </div>
    </SettingsSection>
  );
};

export { MembersSection };
