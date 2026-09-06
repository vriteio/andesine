import { Card, createRef, ScrollShadow, Skeleton, Spinner } from "@andesine/components";
import { Title } from "@solidjs/meta";
import { createAsync, revalidate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { Tree, TREE_ROOT_ID, type TreeMap } from "#web/components/tree";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import {
  groupsQuery,
  membershipsQuery,
  restrictedAssignmentsQuery,
  rolesQuery
} from "#web/lib/data";
import { Setting } from "../settings/setting";
import { SettingsSection } from "../settings/settings-section";
import type { WorkspaceMember } from "../settings/people/members-section/types";
import { AccessItem } from "./access-item";
import { AccessList } from "./access-list";
import { AddAccessMenu, type AccessPrincipal } from "./add-access-menu";

interface RoleAssignments {
  [id: string]: string;
}
interface OptimisticAssignments {
  collectionID: string;
  source: Awaited<ReturnType<typeof restrictedAssignmentsQuery>>;
  groups: RoleAssignments;
  members: RoleAssignments;
}
interface PendingAssignments {
  groupIDs?: string[];
  memberIDs?: string[];
}
interface SaveAssignmentsInput {
  collectionID: string;
  groupRoleIDs: RoleAssignments;
  memberRoleIDs: RoleAssignments;
  pendingGroupIDs: string[];
  pendingMemberIDs: string[];
}
type AccessStatus = "allowed" | "denied" | "loading";

const CollectionPage: Component = () => {
  const params = useParams<{ slug?: string }>();
  const notify = useNotify();
  const { content, currentWorkspace, subscribeToUpdates } = useWorkspace();
  const [scrollableContainerRef, setScrollableContainerRef] = createRef<HTMLElement | null>(null);
  const [optimisticAssignments, setOptimisticAssignments] = createSignal<OptimisticAssignments>();
  const [pendingGroupIDs, setPendingGroupIDs] = createSignal<string[]>([]);
  const [pendingMemberIDs, setPendingMemberIDs] = createSignal<string[]>([]);
  const collectionID = () => params.slug || "";
  const collection = createMemo(() => content.collections.get({ collectionID: collectionID() }));
  const migrationActive = () => {
    return content.hasActiveSchemaMigration(collectionID(), true);
  };
  const canManage = () => {
    return (
      currentWorkspace()?.subscriptionPlan === "pro" &&
      content.canCollection(collectionID(), "collection:manage-restricted-access")
    );
  };
  const accessStatus = createMemo<AccessStatus>(() => {
    if (!currentWorkspace() || content.loading()) return "loading";
    if (content.accessLoading() || content.snapshotError() || !collection()) return "loading";
    if (!canManage() || collection()?.restricted === false) return "denied";

    return "allowed";
  });
  const data = createAsync(async () => {
    const id = collectionID();

    if (!id || accessStatus() !== "allowed") return null;

    const [assignments, groups, members, roles] = await Promise.all([
      restrictedAssignmentsQuery({ collectionID: id }),
      groupsQuery(),
      membershipsQuery(),
      rolesQuery()
    ]);

    return { assignments, collectionID: id, groups, members, roles };
  });
  const title = () => (collection()?.name ? `${collection()?.name} (Restricted access)` : "");
  const accessReady = () => {
    return accessStatus() === "allowed" && data()?.collectionID === collectionID();
  };
  const assignments = () => {
    const loadedData = data();
    const optimistic = optimisticAssignments();

    if (
      optimistic?.collectionID === collectionID() &&
      optimistic?.source === loadedData?.assignments
    ) {
      return optimistic;
    }

    return {
      groups: Object.fromEntries(
        (loadedData?.assignments.groups || []).map(({ groupID, roleID }) => [groupID, roleID])
      ),
      members: Object.fromEntries(
        (loadedData?.assignments.members || []).map(({ memberID, roleID }) => [memberID, roleID])
      )
    };
  };
  const groupRoleIDs = () => assignments().groups;
  const memberRoleIDs = () => assignments().members;
  const roles = () => {
    return (data()?.roles || []).filter((role) => {
      return (
        role.baseRole !== "admin" &&
        (!role.permissions.includes("content") ||
          content.canEntry(collectionID(), "entry:update")) &&
        (!role.permissions.includes("publishing") ||
          content.canCollection(collectionID(), "collection:set-publishing"))
      );
    });
  };
  const members = () => {
    return ((data()?.members || []) as WorkspaceMember[]).filter((member) => !member.admin);
  };
  const assignedGroups = () => {
    return (data()?.groups || []).filter((group) => Boolean(groupRoleIDs()[group.id]));
  };
  const assignedMembers = () => {
    return members().filter((member) => Boolean(memberRoleIDs()[member.id]));
  };
  const groupTree = (): TreeMap => ({
    [TREE_ROOT_ID]: { items: assignedGroups().map((group) => group.id), levels: [] }
  });
  const memberTree = (): TreeMap => ({
    [TREE_ROOT_ID]: { items: assignedMembers().map((member) => member.id), levels: [] }
  });
  const unassignedGroups = (): AccessPrincipal[] => {
    return (data()?.groups || [])
      .filter((group) => !groupRoleIDs()[group.id])
      .map((group) => ({
        detail: `${group.memberIDs.length} ${group.memberIDs.length === 1 ? "member" : "members"}`,
        icon: "i-lucide:users",
        id: group.id,
        label: group.name
      }));
  };
  const unassignedMembers = (): AccessPrincipal[] => {
    return members()
      .filter((member) => !memberRoleIDs()[member.id])
      .map((member) => ({
        detail: member.profile.email,
        icon: "i-lucide:user",
        id: member.id,
        label: member.profile.name || member.profile.email
      }));
  };
  const mutation = createMutation(() => ({
    mutationFn: (input: SaveAssignmentsInput) => {
      return client.collections.setRestrictedAssignments({
        id: input.collectionID,
        groups: Object.entries(input.groupRoleIDs).map(([groupID, roleID]) => ({
          groupID,
          roleID
        })),
        members: Object.entries(input.memberRoleIDs).map(([memberID, roleID]) => ({
          memberID,
          roleID
        }))
      });
    },
    onSuccess: async (_result, input) => {
      await revalidate(restrictedAssignmentsQuery.keyFor({ collectionID: input.collectionID }));
      notify({ type: "success", text: "Restricted access updated" });
    },
    onError: async (error, input) => {
      console.error(error);
      await revalidate(restrictedAssignmentsQuery.keyFor({ collectionID: input.collectionID }));
      notify({ type: "error", text: "Failed to update restricted access" });
    },
    onSettled: (_result, _error, input) => {
      setPendingGroupIDs((current) => {
        return current.filter((id) => !input.pendingGroupIDs.includes(id));
      });
      setPendingMemberIDs((current) => {
        return current.filter((id) => !input.pendingMemberIDs.includes(id));
      });
    }
  }));
  const save = (
    nextGroupRoleIDs: RoleAssignments,
    nextMemberRoleIDs: RoleAssignments,
    pending: PendingAssignments
  ) => {
    const loadedData = data();
    const nextPendingGroupIDs = pending.groupIDs || [];
    const nextPendingMemberIDs = pending.memberIDs || [];

    if (!loadedData || !accessReady() || mutation.isPending || migrationActive()) return;

    setOptimisticAssignments({
      collectionID: loadedData.collectionID,
      source: loadedData.assignments,
      groups: nextGroupRoleIDs,
      members: nextMemberRoleIDs
    });
    setPendingGroupIDs((current) => [...new Set([...current, ...nextPendingGroupIDs])]);
    setPendingMemberIDs((current) => [...new Set([...current, ...nextPendingMemberIDs])]);
    mutation.mutate({
      collectionID: collectionID(),
      groupRoleIDs: nextGroupRoleIDs,
      memberRoleIDs: nextMemberRoleIDs,
      pendingGroupIDs: nextPendingGroupIDs,
      pendingMemberIDs: nextPendingMemberIDs
    });
  };
  const updateGroupRoles = (ids: string[], roleID?: string) => {
    const nextGroupRoleIDs = { ...groupRoleIDs() };

    for (const id of ids) {
      if (roleID) nextGroupRoleIDs[id] = roleID;
      else delete nextGroupRoleIDs[id];
    }

    save(nextGroupRoleIDs, memberRoleIDs(), { groupIDs: ids });
  };
  const updateMemberRoles = (ids: string[], roleID?: string) => {
    const nextMemberRoleIDs = { ...memberRoleIDs() };

    for (const id of ids) {
      if (roleID) nextMemberRoleIDs[id] = roleID;
      else delete nextMemberRoleIDs[id];
    }

    save(groupRoleIDs(), nextMemberRoleIDs, { memberIDs: ids });
  };

  const unsubscribeFromUpdates = subscribeToUpdates((event) => {
    const queryKeys = new Set<string>();

    if (event.action.startsWith("group:")) queryKeys.add(groupsQuery.key);
    if (event.action.startsWith("membership:")) queryKeys.add(membershipsQuery.key);
    if (event.action.startsWith("role:")) queryKeys.add(rolesQuery.key);
    if (
      event.action === "restricted-assignments:update" &&
      event.data.collectionID === collectionID()
    ) {
      queryKeys.add(restrictedAssignmentsQuery.keyFor({ collectionID: collectionID() }));
    }

    if (queryKeys.size > 0) void revalidate([...queryKeys]);
  });

  onCleanup(unsubscribeFromUpdates);

  return (
    <>
      <Title>{title() ? `${title()} | Andesine` : "Andesine"}</Title>
      <Show when={accessStatus() !== "loading"} fallback={<Spinner class="m-auto text-gray-200" />}>
        <div class="flex w-full flex-1 overflow-hidden px-1">
          <div class="relative flex h-full w-full overflow-hidden">
            <ScrollShadow scrollableContainerRef={scrollableContainerRef} />
            <div class="relative z-0 w-full overflow-auto" ref={setScrollableContainerRef}>
              <div class="flex w-full flex-col items-center px-2.5 pb-5 pt-5 md:px-10 md:pb-10 md:pt-9">
                <div class="relative flex w-full max-w-[44rem] flex-col">
                  <h1 class="mb-3 text-4xl font-semibold md:text-5xl">{title()}</h1>
                  <Show
                    when={accessStatus() !== "denied"}
                    fallback={
                      <Card
                        class="flex h-16 items-center justify-center gap-1 rounded-lg bg-gray-50 px-2 text-sm text-gray-400"
                        shade
                      >
                        <div class="i-lucide:lock h-5.5 w-5.5 text-gray-300" />
                        Restricted access cannot be managed for this collection.
                      </Card>
                    }
                  >
                    <Show when={migrationActive()}>
                      <Card
                        class="mb-4 flex h-16 items-center justify-center gap-1 rounded-lg bg-gray-50 px-2 text-sm text-gray-400"
                        shade
                      >
                        <div class="i-tabler:pyramid h-5.5 w-5.5 text-gray-300" />
                        Schema migration in progress. Access settings are read only.
                      </Card>
                    </Show>
                    <SettingsSection label="Groups">
                      <Setting
                        label="Group access"
                        description="Grant access to the restricted collection for entire groups of members"
                        fade={false}
                      >
                        <Show
                          when={accessReady()}
                          fallback={<Skeleton class="h-7 w-full max-w-40 rounded-lg" />}
                        >
                          <AddAccessMenu
                            label="Groups"
                            loading={mutation.isPending || migrationActive()}
                            principals={unassignedGroups()}
                            roles={roles()}
                            onAdd={(id, roleID) => updateGroupRoles([id], roleID)}
                          />
                        </Show>
                      </Setting>
                      <AccessList ready={accessReady()}>
                        <Show
                          when={assignedGroups().length > 0}
                          fallback={
                            <Card
                              class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
                              shade
                            >
                              <div class="i-lucide:users h-5.5 w-5.5 text-gray-300" />
                              No groups with access
                            </Card>
                          }
                        >
                          <div class="relative flex w-full flex-col">
                            <Tree
                              tree={groupTree}
                              itemHeight="2rem"
                              renderItem={(itemID) => {
                                const group = () => {
                                  return assignedGroups().find((current) => current.id === itemID)!;
                                };

                                return (
                                  <AccessItem
                                    id={group().id}
                                    icon="i-lucide:users"
                                    label={group().name}
                                    detail={`${group().memberIDs.length} ${group().memberIDs.length === 1 ? "member" : "members"}`}
                                    roleID={groupRoleIDs()[group().id]}
                                    roles={roles()}
                                    disabled={mutation.isPending || migrationActive()}
                                    loading={pendingGroupIDs().includes(group().id)}
                                    onSetRole={updateGroupRoles}
                                    onRemove={(ids) => updateGroupRoles(ids)}
                                  />
                                );
                              }}
                            />
                          </div>
                        </Show>
                      </AccessList>
                    </SettingsSection>
                    <SettingsSection label="Members">
                      <Setting
                        label="Member access"
                        description="Grant access to the restricted collection for specific members"
                        fade={false}
                      >
                        <Show
                          when={accessReady()}
                          fallback={<Skeleton class="h-7 w-full max-w-40 rounded-lg" />}
                        >
                          <AddAccessMenu
                            label="Members"
                            loading={mutation.isPending || migrationActive()}
                            principals={unassignedMembers()}
                            roles={roles()}
                            onAdd={(id, roleID) => updateMemberRoles([id], roleID)}
                          />
                        </Show>
                      </Setting>
                      <AccessList ready={accessReady()}>
                        <Show
                          when={assignedMembers().length > 0}
                          fallback={
                            <Card
                              class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
                              shade
                            >
                              <div class="i-lucide:user h-5.5 w-5.5 text-gray-300" />
                              No members with access
                            </Card>
                          }
                        >
                          <div class="relative flex w-full flex-col">
                            <Tree
                              tree={memberTree}
                              itemHeight="2rem"
                              renderItem={(itemID) => {
                                const member = () => {
                                  return assignedMembers().find(
                                    (current) => current.id === itemID
                                  )!;
                                };

                                return (
                                  <AccessItem
                                    id={member().id}
                                    icon="i-lucide:id-card"
                                    label={member().profile.name || member().profile.email}
                                    detail={member().profile.email}
                                    roleID={memberRoleIDs()[member().id]}
                                    roles={roles()}
                                    disabled={mutation.isPending || migrationActive()}
                                    loading={pendingMemberIDs().includes(member().id)}
                                    onSetRole={updateMemberRoles}
                                    onRemove={(ids) => updateMemberRoles(ids)}
                                  />
                                );
                              }}
                            />
                          </div>
                        </Show>
                      </AccessList>
                    </SettingsSection>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};

export default CollectionPage;
