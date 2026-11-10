import { ORPCError } from "@orpc/server";

interface RevertCollectionPlacement {
  collectionID: string;
  parentID: string | null;
  rank: string;
}
interface RevertDependencyPlacement extends RevertCollectionPlacement {
  restoreStructure: boolean;
}
interface ResolvePublishingRevertDependenciesInput<Operation extends RevertDependencyPlacement> {
  acceptedPlacementsByID: Map<string, RevertCollectionPlacement>;
  activeParentIDsByID: Map<string, string | null>;
  addDependency(collectionID: string | null): void;
  dependencyOperations: Map<string, Operation>;
  maxAttempts: number;
  removedCollectionIDs: Set<string>;
  requiredCollectionIDs: string[];
  restoredOperations: RevertCollectionPlacement[];
}

const resolvePublishingRevertDependencies = <Operation extends RevertDependencyPlacement>(
  input: ResolvePublishingRevertDependenciesInput<Operation>
): void => {
  const restoredOperationsByID = new Map(
    input.restoredOperations.map((operation) => [operation.collectionID, operation])
  );
  const getFinalParentID = (collectionID: string): string | null => {
    return (
      restoredOperationsByID.get(collectionID)?.parentID ??
      input.dependencyOperations.get(collectionID)?.parentID ??
      input.activeParentIDsByID.get(collectionID) ??
      null
    );
  };
  const hasInvalidFinalPath = (collectionID: string): boolean => {
    const visited = new Set<string>();
    let currentID: string | null = collectionID;

    while (currentID) {
      if (visited.has(currentID) || input.removedCollectionIDs.has(currentID)) return true;

      visited.add(currentID);
      currentID = getFinalParentID(currentID);
    }

    return false;
  };

  for (let attempt = 0; attempt <= input.maxAttempts; attempt += 1) {
    const invalidDependency = [...input.dependencyOperations.values()].find((operation) => {
      const accepted = input.acceptedPlacementsByID.get(operation.collectionID);

      return (
        hasInvalidFinalPath(operation.collectionID) &&
        accepted &&
        operation.parentID !== accepted.parentID
      );
    });

    if (!invalidDependency) break;

    const accepted = input.acceptedPlacementsByID.get(invalidDependency.collectionID)!;

    invalidDependency.parentID = accepted.parentID;
    invalidDependency.rank = accepted.rank;
    invalidDependency.restoreStructure = true;
    input.addDependency(accepted.parentID);
  }

  const revertedCollectionIDs = [
    ...restoredOperationsByID.keys(),
    ...input.dependencyOperations.keys(),
    ...input.requiredCollectionIDs
  ];

  if (revertedCollectionIDs.some(hasInvalidFinalPath)) {
    throw new ORPCError("CONFLICT", {
      message: "Collection structure changed",
      data: {
        hints: [
          "Read publishing.getChannelContent again and review the current changes before submitting a new revert request."
        ]
      }
    });
  }
};

export { resolvePublishingRevertDependencies };
