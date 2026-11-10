import type { AuthorizedCollectionTree, ServiceAuthorizationActions } from "#backend/lib/policy";
import type { PublishingRevertPlan } from "./revert-plan";

const getPublishingRevertAuthorizationActions = (
  plan: PublishingRevertPlan
): ServiceAuthorizationActions => {
  const actions: ServiceAuthorizationActions = {
    collections: [],
    entries: plan.contentEntries.map(({ collectionID }) => ({
      action: "entry:read",
      collectionID
    }))
  };
  const getParentTarget = (parentID: string | null): string | null => {
    return parentID === plan.workspaceRootID ? null : parentID;
  };

  for (const dependency of plan.dependencyCollectionOperations) {
    if (dependency.restoreStructure || dependency.restoreVisibility) {
      actions.collections!.push(
        { action: "collection:update", collectionID: dependency.collectionID },
        { action: "collection:create-child", collectionID: getParentTarget(dependency.parentID) }
      );
    }

    if (dependency.restoreStructure) {
      actions.collections!.push({
        action: "collection:move",
        collectionID: dependency.collectionID
      });
    }

    if (dependency.restorePublishingEnabled) {
      actions.collections!.push({
        action: "collection:set-publishing",
        collectionID: dependency.collectionID
      });
    }
  }

  for (const operation of plan.collectionOperations) {
    if (operation.action === "delete") {
      actions.collections!.push({
        action: "collection:delete",
        collectionID: operation.collectionID
      });
      continue;
    }

    actions.collections!.push({
      action: "collection:update",
      collectionID: operation.collectionID
    });

    if (operation.restoreStructure) {
      actions.collections!.push(
        { action: "collection:move", collectionID: operation.collectionID },
        { action: "collection:create-child", collectionID: getParentTarget(operation.parentID) }
      );
    }

    if (operation.restorePublishingEnabled) {
      actions.collections!.push({
        action: "collection:set-publishing",
        collectionID: operation.collectionID
      });
    }
  }

  for (const operation of plan.entryOperations) {
    const currentCollectionID = operation.workingCollectionID || operation.accepted?.collectionID;

    if (operation.action === "delete") {
      actions.entries!.push({
        action: "entry:delete",
        collectionID: operation.workingCollectionID
      });
      continue;
    }

    if (operation.restoreContent) {
      actions.entries!.push(
        { action: "version:revert", collectionID: currentCollectionID },
        { action: "version:create", collectionID: currentCollectionID }
      );
    }

    if (operation.restoreName) {
      actions.entries!.push({
        action: "entry:update",
        collectionID: operation.workingCollectionID
      });
    }

    if (operation.restoreStructure) {
      actions.entries!.push(
        { action: "entry:move", collectionID: operation.workingCollectionID },
        { action: "entry:create", collectionID: operation.accepted?.collectionID }
      );
    }
  }

  return actions;
};
const canApplyPublishingRevertPlan = (
  authorization: AuthorizedCollectionTree,
  plan: PublishingRevertPlan
): boolean => {
  const actions = getPublishingRevertAuthorizationActions(plan);
  const canApplyCollections = (actions.collections || []).every(({ action, collectionID }) => {
    return authorization.canCollection(collectionID, action);
  });
  const canApplyEntries = (actions.entries || []).every(({ action, collectionID }) => {
    return authorization.canEntry(collectionID, action);
  });

  return canApplyCollections && canApplyEntries;
};

export { canApplyPublishingRevertPlan, getPublishingRevertAuthorizationActions };
