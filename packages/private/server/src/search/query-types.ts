import {
  type BooleanPropertyFilter as SearchBooleanPropertyFilter,
  type DatePropertyFilter as SearchDatePropertyFilter,
  type NumberPropertyFilter as SearchNumberPropertyFilter,
  type PropertyFilter as SearchPropertyFilter,
  type TextPropertyFilter as SearchTextPropertyFilter
} from "@andesine/contracts/search";
import type { SearchPropertyValue } from "./types";

interface SearchInput {
  signal?: AbortSignal;
  collectionID?: string;
  collectionPath?: string;
  collectionSlugPath?: string;
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
  collectionSlugPath?: string;
  filters: SearchPropertyFilter[];
  history: AskHistoryMessage[];
  question: string;
}

interface PublishedAskInput extends AskInput {
  channel: string;
}

interface SearchResultItem {
  path: string;
  slugPath: string;
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
