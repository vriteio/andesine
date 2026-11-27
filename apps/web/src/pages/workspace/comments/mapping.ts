import type {
  EditorCommentThread,
  EditorOwnSuggestion,
  EditorSuggestionPatch
} from "@andesine/editor";
import { type CommentThread } from "#web/lib/data/comments";

interface ThreadMapping {
  getMemberName(memberID: string | null): string;
  getMemberImage?(memberID: string | null): string | undefined;
  isOwn(author: CommentAuthor): boolean;
  canResolve: boolean;
}

type CommentAuthor = Pick<CommentThread, "authorID" | "visitor">;

/** A title patch has no blocks, as the API takes one source. */
const toSuggestionInput = ({ blockIDs, after, blocks, title }: EditorSuggestionPatch) => {
  return title === undefined ? { blockIDs, after, blocks } : { blockIDs, after, title };
};
const mapThread = (thread: CommentThread, mapping: ThreadMapping): EditorCommentThread => ({
  id: thread.id,
  anchor: thread.anchor,
  blockID: thread.blockID,
  resolved: thread.resolvedAt !== null,
  autoResolved: thread.autoResolved,
  quote: thread.quote,
  status: thread.status,
  suggestion: thread.suggestion && { ...thread.suggestion, applied: thread.appliedAt !== null },
  comments: thread.comments.map((comment) => ({
    id: comment.id,
    authorName: comment.visitor
      ? `${comment.visitor.name ?? "Anonymous"} (visitor)`
      : mapping.getMemberName(comment.authorID),
    authorImage: comment.visitor ? undefined : mapping.getMemberImage?.(comment.authorID),
    content: comment.content,
    createdAt: comment.createdAt,
    editable: mapping.isOwn(comment),
    deletable: mapping.isOwn(comment) || mapping.canResolve
  }))
});
/** The user's open suggestions, oldest first, for suggesting mode. */
const getOwnSuggestions = (
  threads: CommentThread[],
  isOwn: (author: CommentAuthor) => boolean
): EditorOwnSuggestion[] => {
  const sorted = [...threads].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return sorted.flatMap((thread) => {
    const { suggestion, comments } = thread;
    const isOwnOpen = suggestion && !thread.resolvedAt && !thread.appliedAt && isOwn(thread);

    if (!isOwnOpen) return [];

    return [
      {
        ...suggestion,
        title: suggestion.title?.suggested,
        titleBase: suggestion.title?.base,
        threadID: thread.id,
        status: thread.status,
        discussed: comments.length > 1 || Boolean(comments[0]?.content.trim())
      }
    ];
  });
};

export { getOwnSuggestions, mapThread, toSuggestionInput };
