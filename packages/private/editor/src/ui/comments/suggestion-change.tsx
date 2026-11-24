import { IconButton } from "@andesine/components";
import type { JSONContent } from "@tiptap/core";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import type {
  EditorComments,
  EditorCommentSuggestion,
  EditorCommentThread
} from "#editor/client-types";
import { type AttributeChange, getAttributeChanges } from "#editor/lib/suggestion-diff";
import { alignBlocks, isSame } from "#editor/lib/suggestion-ranges";
import { describeBlock } from "./panel";

interface SuggestionChangeProps {
  thread: EditorCommentThread;
  suggestion: EditorCommentSuggestion;
  comments: EditorComments;
  rejecting: boolean;
  onReject(): void;
}

const nameBlock = ({ type, attrs }: JSONContent) => {
  const { label } = describeBlock(type ?? "", attrs);

  return type === "element" ? label : label.toLowerCase();
};
const describeBlocks = (verb: string, nodes: JSONContent[]) => {
  return nodes.length === 1 ? `${verb} ${nameBlock(nodes[0])}` : `${verb} ${nodes.length} blocks`;
};
const collectAttributeChanges = (base: JSONContent[], blocks: JSONContent[]): AttributeChange[] => {
  return alignBlocks(base, blocks).flatMap(({ main, fork }) => {
    const isSameBlock = main?.type === fork?.type && main?.attrs?.name === fork?.attrs?.name;

    if (!main || !fork || !isSameBlock) return [];

    return [
      ...getAttributeChanges(fork.type ?? "", main.attrs, fork.attrs),
      ...collectAttributeChanges(main.content ?? [], fork.content ?? [])
    ];
  });
};
/** E.g. "Edits text, adds image" or "Replaces image". */
const describeSuggestion = ({ base, blocks, title }: EditorCommentSuggestion) => {
  if (title) return `Renames to “${title.suggested}”`;

  const steps = alignBlocks(base, blocks);
  const edited = steps.flatMap(({ main, fork }) => {
    return main && fork && !isSame(main, fork) ? [fork] : [];
  });
  const added = steps.flatMap(({ main, fork }) => (fork && !main ? [fork] : []));
  const removed = steps.flatMap(({ main, fork }) => (main && !fork ? [main] : []));
  const isSwap = !edited.length && added.length === 1 && removed[0]?.type === added[0].type;
  const image = edited[0]?.type === "image" ? steps.find(({ fork }) => fork === edited[0]) : null;
  // A new image is a replacement; other changes, e.g. its alt text, are edits.
  const isImageReplaced =
    edited.length === 1 && image?.main?.attrs?.assetID !== image?.fork?.attrs?.assetID;
  const parts = isSwap
    ? [describeBlocks("replaces", added)]
    : [
        edited.length ? describeBlocks(isImageReplaced ? "replaces" : "edits", edited) : "",
        added.length ? describeBlocks("adds", added) : "",
        removed.length ? describeBlocks("removes", removed) : ""
      ].filter(Boolean);
  const text = parts.join(", ") || "suggested change";

  return text.charAt(0).toUpperCase() + text.slice(1);
};

const SuggestionChange: Component<SuggestionChangeProps> = (props) => {
  const [applying, setApplying] = createSignal(false);
  const isOpen = () => !props.thread.resolved && !props.suggestion.applied;
  const attributes = createMemo(() => {
    return collectAttributeChanges(props.suggestion.base, props.suggestion.blocks);
  });
  const canApply = () => isOpen() && props.comments.canApply && props.thread.status === "active";
  const apply = async () => {
    setApplying(true);

    try {
      await props.comments.apply(props.thread.id);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div class="flex flex-col gap-1">
      <div class="flex gap-1 text-sm text-gray-500">
        <div class="i-lucide:file-diff mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <span>{describeSuggestion(props.suggestion)}</span>
      </div>
      <Show when={attributes().length}>
        <ul class="flex flex-col gap-1 text-sm text-gray-500">
          <For each={attributes()}>
            {({ label, before, after }) => (
              <li class="flex gap-1">
                <div class="i-lucide:tag mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span class="min-w-0 break-words">
                  {label}
                  <Show when={before ?? after} fallback=" changed">
                    {": "}
                    <Show when={before}>
                      <span class="text-red-600 line-through">{before}</span>
                    </Show>
                    <Show when={before && after}>
                      <span class="i-lucide:chevron-right mx-0.5 inline-block h-3 w-3 align-middle text-gray-400" />
                    </Show>
                    <Show when={after}>
                      <span class="text-green-700">{after}</span>
                    </Show>
                  </Show>
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={isOpen()}>
        <div class="flex items-center gap-1">
          <Show when={canApply()}>
            <IconButton
              class="flex-row-reverse pr-1"
              icon="i-lucide:check"
              iconProps={{ class: "h-3.5 w-3.5" }}
              label={() => <span class="pl-0.5 pr-1">Apply</span>}
              size="xs"
              variant="primary"
              loading={applying()}
              onClick={apply}
            />
          </Show>
          <Show when={props.comments.canResolve}>
            <IconButton
              class="flex-row-reverse pr-1"
              icon="i-lucide:x"
              iconProps={{ class: "h-3.5 w-3.5" }}
              label={() => <span class="pl-0.5 pr-1">Reject</span>}
              size="xs"
              variant="secondary"
              loading={props.rejecting}
              onClick={props.onReject}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
};

export { SuggestionChange };
