import type {
  BooleanPropertyFilter as SearchBooleanPropertyFilter,
  DatePropertyFilter as SearchDatePropertyFilter,
  NumberPropertyFilter as SearchNumberPropertyFilter,
  PropertyFilter as SearchPropertyFilter,
  TextPropertyFilter as SearchTextPropertyFilter
} from "#backend/lib/content/properties";
import type { SearchPropertyValue } from "./types";

interface SearchInput {
  signal?: AbortSignal;
  collectionID?: string;
  collectionPath?: string;
  filters: SearchPropertyFilter[];
  limit: number;
  query: string;
  semantic: boolean;
}

interface PublishedSearchInput extends SearchInput {
  channel: string;
}

interface AskHistoryMessage {
  content: string;
  role: "assistant" | "user";
}

interface AskInput {
  signal?: AbortSignal;
  collectionID?: string;
  collectionPath?: string;
  filters: SearchPropertyFilter[];
  history: AskHistoryMessage[];
  question: string;
}

interface PublishedAskInput extends AskInput {
  channel: string;
}

interface SearchResultItem {
  path: string;
  anchor?: string;
  snapshotID?: string;
  channel?: string;
  collectionID?: string;
  collectionPath: string[];
  entryID: string;
  headingPath: string[];
  properties: SearchPropertyValue[];
  snippet: string;
  title: string;
  updatedAt: string;
  versionID?: string;
}

interface SearchResult {
  results: SearchResultItem[];
}

interface AskSource extends SearchResultItem {
  id: number;
  relevance: number;
}

interface PublishedSearchResultItem extends SearchResultItem {
  channel: string;
  snapshotID: string;
  versionID: string;
}
interface PublishedSearchResult {
  results: PublishedSearchResultItem[];
}
interface PublishedAskSource extends PublishedSearchResultItem {
  id: number;
  relevance: number;
}
interface PublishedAskResult {
  answer: string;
  sources: PublishedAskSource[];
}

interface AskResult {
  answer: string;
  sources: AskSource[];
}

export type {
  PublishedSearchResultItem,
  PublishedSearchResult,
  PublishedAskSource,
  PublishedAskResult,
  AskHistoryMessage,
  AskInput,
  AskResult,
  AskSource,
  PublishedAskInput,
  PublishedSearchInput,
  SearchBooleanPropertyFilter,
  SearchDatePropertyFilter,
  SearchInput,
  SearchNumberPropertyFilter,
  SearchPropertyFilter,
  SearchResult,
  SearchResultItem,
  SearchTextPropertyFilter
};
