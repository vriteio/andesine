import type { JSONContent } from "@tiptap/core";
import type { EditorSuggestionPatch } from "#editor/client-types";

interface BlockStep {
  main?: JSONContent;
  fork?: JSONContent;
}

type SuggestionRange = Omit<EditorSuggestionPatch, "title">;

const getBlockID = (node: JSONContent | undefined): string | null => {
  return typeof node?.attrs?.id === "string" ? node.attrs.id : null;
};
const isSame = (a: JSONContent, b: JSONContent) => JSON.stringify(a) === JSON.stringify(b);
const isEmptyParagraph = (node: JSONContent) => node.type === "paragraph" && !node.content?.length;
const isFragment = (step: BlockStep) => (step.main ?? step.fork)?.type === "fragment";
const isMatched = (step: BlockStep | undefined): step is Required<BlockStep> => {
  return Boolean(step?.main && step.fork) && !isFragment(step!);
};
const isUnchanged = (step: BlockStep) => isMatched(step) && isSame(step.main, step.fork);
const walkBlockIDs = (node: JSONContent, visit: (id: string) => void) => {
  const id = getBlockID(node);

  if (id) visit(id);

  for (const child of node.content ?? []) walkBlockIDs(child, visit);
};
const isPaired = (main: JSONContent | undefined, fork: JSONContent | undefined) => {
  const id = getBlockID(main);

  return id !== null && id === getBlockID(fork);
};
/** Pairs blocks by ID with a longest-common-subsequence table. */
const alignMiddle = (main: JSONContent[], fork: JSONContent[]): BlockStep[] => {
  const lengths = Array.from({ length: main.length + 1 }, () => {
    return new Uint32Array(fork.length + 1);
  });
  const steps: BlockStep[] = [];

  let i = 0;
  let j = 0;

  for (let a = main.length - 1; a >= 0; a -= 1) {
    for (let b = fork.length - 1; b >= 0; b -= 1) {
      lengths[a][b] = isPaired(main[a], fork[b])
        ? lengths[a + 1][b + 1] + 1
        : Math.max(lengths[a + 1][b], lengths[a][b + 1]);
    }
  }

  while (i < main.length || j < fork.length) {
    const takesFork =
      i === main.length || (j < fork.length && lengths[i][j + 1] >= lengths[i + 1][j]);

    if (i < main.length && j < fork.length && isPaired(main[i], fork[j])) {
      steps.push({ main: main[i], fork: fork[j] });
      i += 1;
      j += 1;
    } else if (takesFork) {
      steps.push({ fork: fork[j] });
      j += 1;
    } else {
      steps.push({ main: main[i] });
      i += 1;
    }
  }

  return steps;
};
/** Pairs matching ends first, so the quadratic table covers only the changed middle. */
const alignBlocks = (main: JSONContent[], fork: JSONContent[]): BlockStep[] => {
  let head = 0;
  let tail = 0;

  while (head < main.length && head < fork.length && isPaired(main[head], fork[head])) head += 1;

  while (
    tail < main.length - head &&
    tail < fork.length - head &&
    isPaired(main[main.length - 1 - tail], fork[fork.length - 1 - tail])
  ) {
    tail += 1;
  }

  const pair = (from: number, to: number, forkFrom: number) => {
    return main
      .slice(from, to)
      .map((node, index) => ({ main: node, fork: fork[forkFrom + index] }));
  };

  return [
    ...pair(0, head, 0),
    ...alignMiddle(main.slice(head, main.length - tail), fork.slice(head, fork.length - tail)),
    ...pair(main.length - tail, main.length, fork.length - tail)
  ];
};
const createRange = (steps: BlockStep[], start: number, end: number): SuggestionRange | null => {
  const run = steps.slice(start, end);
  const previous = steps[start - 1];
  const next = steps[end];
  const base = run.flatMap(({ main }) => (main ? [main] : []));
  // New empty paragraphs aren't changes, e.g. after Enter or the trailing node.
  const blocks = run.flatMap(({ main, fork }) => {
    return fork && (main || !isEmptyParagraph(fork)) ? [fork] : [];
  });
  const blockIDs = base.map(getBlockID);

  if (!base.length && !blocks.length) return null;

  if (blockIDs.includes(null)) return null;

  if (base.length) return { blockIDs: blockIDs as string[], after: null, blocks };

  // After a block both have, fragments included.
  if (previous?.main && previous.fork) {
    return { blockIDs: [], after: getBlockID(previous.main), blocks };
  }

  // Without a block before it, an insertion replaces the block after it, too.
  if (isMatched(next)) {
    return {
      blockIDs: [getBlockID(next.main)!],
      after: null,
      blocks: [...blocks, next.fork]
    };
  }

  // Before a fragment, which is only in the root: at the start, after the title.
  if (!previous && next && isFragment(next)) return { blockIDs: [], after: null, blocks };

  return null;
};
/** Whether a nested block moved between steps, e.g. by a drag or an indent. */
const hasMoves = (steps: BlockStep[]) => {
  const owners = new Map<string, number>();

  steps.forEach(({ main }, index) => main && walkBlockIDs(main, (id) => owners.set(id, index)));

  return steps.some(({ fork }, index) => {
    let isMoved = false;

    if (fork) walkBlockIDs(fork, (id) => (isMoved ||= owners.has(id) && owners.get(id) !== index));

    return isMoved;
  });
};
const isSameKind = (a: JSONContent, b: JSONContent) => {
  return a.type === b.type && JSON.stringify(a.attrs) === JSON.stringify(b.attrs);
};
/** Children with IDs are blocks, e.g. rows or list items. */
const hasBlockChildren = (node: JSONContent) => {
  return Boolean(node.content?.length && node.content.every((child) => getBlockID(child)));
};
const getColumnCount = ({ content = [] }: JSONContent) => {
  return Math.max(0, ...content.map((row) => row.content?.length ?? 0));
};
/** Adds or removes a non-empty block, e.g. on Enter. */
const isAddedOrRemoved = (step: BlockStep | undefined) => {
  return Boolean(
    step && !isMatched(step) && !isFragment(step) && (step.main || !isEmptyParagraph(step.fork!))
  );
};
/**
 * Adds the ranges; false when a change can't be a range, so its container is one instead.
 * Blocks of the same unit, e.g. a saved suggestion's, stay one range, as do their children.
 */
const collectRanges = (
  main: JSONContent[],
  fork: JSONContent[],
  ranges: SuggestionRange[],
  units: Map<string, string>
): boolean => {
  const steps = alignBlocks(main, fork);
  const changed = steps.flatMap((step, index) => {
    const isNewEmpty = !step.main && step.fork && isEmptyParagraph(step.fork);

    return isUnchanged(step) || isNewEmpty ? [] : [index];
  });
  const [first = 0, last = -1] = [changed[0], changed.at(-1)];
  const isMoveSpan = hasMoves(steps) && !steps.slice(first, last + 1).some(isFragment);

  // A moved block is one change with its old and new place, so applying it can't split it.
  if (isMoveSpan) {
    const range = createRange(steps, first, last + 1);

    if (range) ranges.push(range);

    return Boolean(range);
  }

  let start = -1;
  let runUnit: string | undefined;
  let complete = true;
  // The step an insertion at the start took in, as it has no block before it.
  let absorbed = -1;

  const open = (index: number, unit: string | undefined) => {
    start = index;
    runUnit = unit;
  };
  const close = (end: number) => {
    if (start < 0) return;

    const run = steps.slice(start, end);
    const range = createRange(steps, start, end);
    const hasChanges = run.some(({ main, fork }) => main || (fork && !isEmptyParagraph(fork)));
    const isStartInsertion = range?.blockIDs.length && !run.some(({ main }) => main);

    if (range) {
      ranges.push(range);
    } else if (hasChanges) {
      complete = false;
    }

    if (isStartInsertion) absorbed = end;

    start = -1;
    runUnit = undefined;
  };

  steps.forEach((step, index) => {
    const unit = units.get(getBlockID(step.main ?? step.fork) ?? "");
    // Unchanged blocks between a unit's changes stay in its range.
    const joinsRun = start >= 0 && unit !== undefined && unit === runUnit;
    const isOtherUnit = unit !== undefined && runUnit !== undefined && unit !== runUnit;

    if (joinsRun && !isFragment(step)) return;

    if (isFragment(step)) {
      close(index);

      if (step.main && step.fork) {
        collectRanges(step.main.content ?? [], step.fork.content ?? [], ranges, units);
      }
    } else if (isUnchanged(step)) {
      close(index);
    } else if (isMatched(step)) {
      // Containers without changes of their own, e.g. tables, suggest their changed children.
      const nested: SuggestionRange[] = [];
      // A new or removed column changes each row, so the table is one change.
      const isContainer =
        unit === undefined &&
        isSameKind(step.main, step.fork) &&
        (step.main.type !== "table" || getColumnCount(step.main) === getColumnCount(step.fork)) &&
        hasBlockChildren(step.main) &&
        hasBlockChildren(step.fork);
      const isNested =
        isContainer &&
        collectRanges(step.main.content ?? [], step.fork.content ?? [], nested, units);

      close(index);

      if (absorbed === index) return;

      if (isNested) {
        ranges.push(...nested);
      } else {
        // One edited block per suggestion, with blocks added or removed after it, to apply each alone.
        open(index, unit);

        if (unit === undefined && !isAddedOrRemoved(steps[index + 1])) close(index + 1);
      }
    } else if (start < 0) {
      open(index, unit);
    } else if (isOtherUnit) {
      close(index);
      open(index, unit);
    } else {
      runUnit ??= unit;
    }
  });
  close(steps.length);

  return complete;
};
const getSuggestionRanges = (
  main: JSONContent,
  fork: JSONContent,
  units = new Map<string, string>()
): SuggestionRange[] => {
  const ranges: SuggestionRange[] = [];
  const blocks = (document: JSONContent) => {
    return (document.content ?? []).filter((node) => node.type !== "title");
  };

  collectRanges(blocks(main), blocks(fork), ranges, units);

  return ranges;
};

export { alignBlocks, getBlockID, getSuggestionRanges, isSame, walkBlockIDs };
