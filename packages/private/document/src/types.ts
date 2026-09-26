interface ContentMark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface ContentNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ContentNode[];
  marks?: ContentMark[];
  text?: string;
}

export type { ContentMark, ContentNode };
