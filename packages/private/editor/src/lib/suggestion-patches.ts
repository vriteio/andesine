import type { JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { normalizeEntryTitle, type RebaseOptions } from "@andesine/document";
import type { EditorOwnSuggestion, EditorSuggestionPatch } from "#editor/client-types";
import { getBlocks } from "#editor/extensions/comments";
import { replaceSuggestion } from "./suggestion-apply";
import { getBlockID, getSuggestionRanges, isSame, walkBlockIDs } from "./suggestion-ranges";
import { rebaseSuggestion } from "./suggestion-status";

interface SuggestionDocuments {
  main: JSONContent;
  fork: JSONContent;
}
interface LoadedSuggestions {
  loaded: EditorOwnSuggestion[];
  /** Overlap loaded ones; joined into them on the next save. */
  merged: EditorOwnSuggestion[];
}

// Patches are immutable, so their IDs are cached.
const patchIDs = new WeakMap<EditorSuggestionPatch, Set<string>>();

/** Client errors that fail again on retry; 401, 408 and 429 can pass. */
const isRejectedSave = (reason: unknown) => {
  const status = (reason as { status?: unknown } | null)?.status;
  const isTemporary = status === 401 || status === 408 || status === 429;

  return typeof status === "number" && status >= 400 && status < 500 && !isTemporary;
};
const toPatch = ({
  blockIDs,
  after,
  blocks,
  title
}: EditorSuggestionPatch): EditorSuggestionPatch => {
  return { blockIDs, after, blocks, title };
};
const isSamePatch = (a: EditorSuggestionPatch, b: EditorSuggestionPatch) => {
  return isSame(toPatch(a), toPatch(b));
};
/** IDs of the blocks a patch replaces or adds, with their children's. */
const getPatchIDs = (patch: EditorSuggestionPatch) => {
  const cached = patchIDs.get(patch);

  if (cached) return cached;

  const ids = new Set(patch.blockIDs);

  for (const block of patch.blocks) walkBlockIDs(block, (id) => ids.add(id));

  patchIDs.set(patch, ids);

  return ids;
};
const overlaps = (a: EditorSuggestionPatch, b: EditorSuggestionPatch) => {
  if (a.title !== undefined || b.title !== undefined) {
    return a.title !== undefined && b.title !== undefined;
  }

  const ids = getPatchIDs(a);
  const sameInsertion = a.after !== null && a.after === b.after;

  return sameInsertion || [...getPatchIDs(b)].some((id) => ids.has(id));
};
/** Whether a suggestion changes blocks inside another's, e.g. adds a row to its table. */
const isInside = (inner: EditorSuggestionPatch, outer: EditorSuggestionPatch) => {
  const top = new Set([...outer.blockIDs, ...outer.blocks.map(getBlockID)]);

  return inner.after !== null && getPatchIDs(outer).has(inner.after) && !top.has(inner.after);
};
/** Each block's oldest saved thread, so a unit stays one range. */
const getUnits = (known: Map<string, EditorSuggestionPatch>) => {
  const units = new Map<string, string>();
  // Units by any patch ID or insertion place, and by nested IDs only.
  const owners = new Map<string, string>();
  const nestedOwners = new Map<string, string>();

  for (const [threadID, patch] of known) {
    const top = [...patch.blockIDs, ...patch.blocks.map(getBlockID)];
    const ids = getPatchIDs(patch);
    const place = patch.after === null ? null : `after:${patch.after}`;
    const joined = [...ids, place].map((id) => id && owners.get(id)).find(Boolean);
    const unit = joined ?? (patch.after && nestedOwners.get(patch.after)) ?? threadID;

    for (const id of top) {
      if (id && !units.has(id)) units.set(id, unit);
    }

    for (const id of [...ids, place]) {
      if (id && !owners.has(id)) owners.set(id, unit);

      if (id && !top.includes(id) && !nestedOwners.has(id)) nestedOwners.set(id, unit);
    }
  }

  return units;
};
const getTitle = (doc: JSONContent) => {
  const title = doc.content?.[0]?.type === "title" ? doc.content[0] : null;

  return normalizeEntryTitle(title?.content?.map(({ text }) => text ?? "").join("") ?? "");
};
/** Block ranges, plus a separate title patch. */
const getSuggestionPatches = (
  { main, fork }: SuggestionDocuments,
  units: Map<string, string>
): EditorSuggestionPatch[] => {
  const title = getTitle(fork);
  const patches = getSuggestionRanges(main, fork, units);

  return title === getTitle(main)
    ? patches
    : [...patches, { blockIDs: [], after: null, blocks: [], title }];
};
/** Rebases and applies a suggestion; false when it doesn't fit. */
const replaces = (tr: Transaction, own: EditorOwnSuggestion, options?: RebaseOptions) => {
  const { title, titleBase = "", ...rest } = own;
  const titles = title === undefined ? undefined : { base: titleBase, suggested: title };
  const rebased = rebaseSuggestion(tr.doc, { ...rest, title: titles, applied: false }, options);

  return rebased ? replaceSuggestion(tr, rebased) : false;
};
/** Whether the fork already has the suggestion's changes. */
const isContained = (fork: ProseMirrorNode, { blockIDs, blocks, title }: EditorSuggestionPatch) => {
  const found = getBlocks(fork);
  const isReplaced = (id: string) => {
    return blocks.some((block) => getBlockID(block) === id) || !found.has(id);
  };
  const isShown = (block: JSONContent) => {
    try {
      return Boolean(
        found.get(getBlockID(block) ?? "")?.node.eq(fork.type.schema.nodeFromJSON(block))
      );
    } catch {
      return false;
    }
  };

  if (title !== undefined) return getTitle(fork.toJSON()) === title;

  return blocks.every(isShown) && blockIDs.every(isReplaced);
};
/**
 * Discussed suggestions load first. An undiscussed overlapping one joins loaded ones unless one
 * is discussed; else it stays a card, or joins as a copy.
 */
const loadOwnSuggestions = (tr: Transaction, own: EditorOwnSuggestion[]): LoadedSuggestions => {
  const ordered = [...own].sort((a, b) => Number(b.discussed) - Number(a.discussed));
  const result: LoadedSuggestions = { loaded: [], merged: [] };

  for (const suggestion of ordered) {
    const overlapping = result.loaded.filter((other) => {
      return overlaps(other, suggestion) || isInside(suggestion, other);
    });
    const isJoinable = !suggestion.discussed && overlapping.length > 0;
    const isCopy = isJoinable && isContained(tr.doc, suggestion);
    const canChange = isJoinable && overlapping.every(({ discussed }) => !discussed);

    if (isCopy || (canChange && replaces(tr, suggestion, { preferSuggested: true }))) {
      result.merged.push(suggestion);
    } else if (!overlapping.length && replaces(tr, suggestion)) {
      result.loaded.push(suggestion);
    }
  }

  return result;
};

export {
  getSuggestionPatches,
  getUnits,
  isRejectedSave,
  isSamePatch,
  loadOwnSuggestions,
  overlaps,
  toPatch
};
export type { SuggestionDocuments };
