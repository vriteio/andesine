import { rankBetweenNeighbors } from "#backend/lib/primitives";

interface SnapshotEntryPosition {
  collectionID: string | null;
  entryID: string;
  rank: string;
}
interface ResolveSnapshotEntryRanksInput {
  acceptedEntries: SnapshotEntryPosition[];
  reserveSelectedRanks?: boolean;
  selectedEntryIDs: string[];
  workingEntries: SnapshotEntryPosition[];
}

const resolveSnapshotEntryRanks = (input: ResolveSnapshotEntryRanksInput): Map<string, string> => {
  const selectedEntryIDs = new Set(input.selectedEntryIDs);
  const acceptedByID = new Map(input.acceptedEntries.map((entry) => [entry.entryID, entry]));
  const unselectedByID = new Map(
    input.acceptedEntries
      .filter((entry) => !selectedEntryIDs.has(entry.entryID))
      .map((entry) => [entry.entryID, entry])
  );
  const workingByCollectionID = new Map<string | null, SnapshotEntryPosition[]>();
  const ranksByCollectionID = new Map<string | null, Set<string>>();
  const reservedRanksByCollectionID = new Map<string | null, Map<string, string>>();
  const resolvedRanks = new Map<string, string>();

  // In-place restoration must not use a rank still occupied by another selected item.
  if (input.reserveSelectedRanks) {
    for (const entry of input.acceptedEntries) {
      if (!selectedEntryIDs.has(entry.entryID)) continue;

      const ranks =
        reservedRanksByCollectionID.get(entry.collectionID) || new Map<string, string>();

      ranks.set(entry.rank, entry.entryID);
      reservedRanksByCollectionID.set(entry.collectionID, ranks);
    }
  }

  for (const entry of input.workingEntries) {
    const siblings = workingByCollectionID.get(entry.collectionID) || [];

    siblings.push(entry);
    workingByCollectionID.set(entry.collectionID, siblings);
  }

  for (const entry of unselectedByID.values()) {
    const ranks = ranksByCollectionID.get(entry.collectionID) || new Set<string>();

    ranks.add(entry.rank);
    ranksByCollectionID.set(entry.collectionID, ranks);
  }

  for (const [collectionID, siblings] of workingByCollectionID) {
    const ranks = ranksByCollectionID.get(collectionID) || new Set<string>();
    const reservedRanks =
      reservedRanksByCollectionID.get(collectionID) || new Map<string, string>();
    const nextEntries: Array<SnapshotEntryPosition | undefined> = [];
    let previous: SnapshotEntryPosition | undefined;
    let previousSelected: SnapshotEntryPosition | undefined;
    let nextAccepted: SnapshotEntryPosition | undefined;

    siblings.sort((left, right) => left.rank.localeCompare(right.rank));

    for (let index = siblings.length - 1; index >= 0; index -= 1) {
      const accepted = unselectedByID.get(siblings[index].entryID);

      nextEntries[index] = nextAccepted;
      if (accepted?.collectionID === collectionID) nextAccepted = accepted;
    }

    for (let index = 0; index < siblings.length; index += 1) {
      const entry = siblings[index];

      if (!selectedEntryIDs.has(entry.entryID)) {
        const accepted = unselectedByID.get(entry.entryID);

        if (accepted?.collectionID === collectionID) {
          // Pending moves of unselected siblings must not reverse the selected entries.
          previous =
            previousSelected && previousSelected.rank > accepted.rank ? previousSelected : accepted;
        }

        continue;
      }

      const next = nextEntries[index];
      // Conflicting anchors reflect an unrelated draft reorder. Keep the accepted sibling order.
      const nextRank = next && (!previous || previous.rank < next.rank) ? next.rank : null;
      const fitsPosition = (rank: string) => {
        return (
          !ranks.has(rank) &&
          (!reservedRanks.has(rank) || reservedRanks.get(rank) === entry.entryID) &&
          (!previous || rank > previous.rank) &&
          (!nextRank || rank < nextRank)
        );
      };
      const accepted = acceptedByID.get(entry.entryID);
      let rank: string;

      if (accepted?.collectionID === collectionID && fitsPosition(accepted.rank)) {
        rank = accepted.rank;
      } else if (fitsPosition(entry.rank)) {
        rank = entry.rank;
      } else {
        const orderedRanks = [...new Set([...ranks, ...reservedRanks.keys()])].sort();

        if (previous) {
          const previousRank = previous.rank;
          const upper = orderedRanks.find((value) => value > previousRank);

          rank = rankBetweenNeighbors(previousRank, upper);
        } else if (nextRank) {
          const lower = orderedRanks[orderedRanks.indexOf(nextRank) - 1];

          rank = rankBetweenNeighbors(lower, nextRank);
        } else {
          const upperIndex = orderedRanks.findIndex((value) => value > entry.rank);
          const lower =
            upperIndex === -1
              ? orderedRanks[orderedRanks.length - 1]
              : orderedRanks[upperIndex - 1];
          const upper = upperIndex === -1 ? undefined : orderedRanks[upperIndex];

          rank = rankBetweenNeighbors(lower, upper);
        }
      }

      ranks.add(rank);
      previous = { ...entry, rank };
      previousSelected = previous;
      resolvedRanks.set(entry.entryID, rank);
    }
  }

  return resolvedRanks;
};

export { resolveSnapshotEntryRanks };
