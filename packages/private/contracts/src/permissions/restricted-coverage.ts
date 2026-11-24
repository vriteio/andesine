/**
 * Whether selected collections cover every restricted boundary on a root-first lineage, as member
 * assignments do: each boundary needs a selected collection between it and the next boundary below.
 */
const coversRestrictedLineage = (
  lineage: string[],
  boundaryIDs: string[],
  isSelected: (id: string) => boolean
): boolean => {
  const starts = boundaryIDs.map((id) => lineage.indexOf(id));

  return starts.every((start, index) => {
    return lineage.slice(start, starts[index + 1] ?? lineage.length).some(isSelected);
  });
};

export { coversRestrictedLineage };
