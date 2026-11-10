interface SearchItem {
  id: string;
  /** Page URL, with a heading hash when the match is in a section. */
  href: string;
  title: string;
  /** Plain text around the match. */
  excerpt: string;
  headingPath: string[];
}

interface SearchGroup {
  sourceID: string;
  label: string;
  items: SearchItem[];
  /** Set when this source failed; other groups can still have results. */
  error?: string;
}

/** A page that an answer cites as `[id]`. */
interface AnswerSource {
  id: number;
  href: string;
  title: string;
  headingPath: string[];
  collectionPath: string[];
}

interface Answer {
  text: string;
  sources: AnswerSource[];
  sourcesReceived: boolean;
}

interface AnswerMessage {
  role: "user" | "assistant";
  content: string;
}

type AnswerEvent =
  | { type: "sources"; sources: AnswerSource[] }
  | { type: "textDelta"; text: string }
  | { type: "completed"; answer: string; sources: AnswerSource[] }
  | { type: "error"; error: string };

export type { SearchItem, SearchGroup, AnswerSource, Answer, AnswerMessage, AnswerEvent };
