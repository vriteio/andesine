import {
  buildSearchFilter,
  CURRENT_SEARCH_COLLECTION_ALIAS,
  getVectorQuery,
  matchesSearchFilters,
  PUBLISHED_SEARCH_COLLECTION_ALIAS,
  type PublishedSearchResult,
  type SearchDocument,
  type SearchFilterInput,
  type SearchResult,
  type SearchResultItem,
  type TypesenseSearchParameters,
  type TypesenseSearchResult,
  TypesenseAPIError
} from "#backend/lib/search";
import { searchOpenAIClient, searchTypesenseClient } from "#backend/lib/search/clients";
import { ORPCError } from "@orpc/server";

interface SearchDocumentAuthorizer {
  (documents: SearchDocument[]): Promise<Set<string>>;
}

interface SearchIndexInput extends SearchFilterInput {
  authorizeDocuments?: SearchDocumentAuthorizer;
  limit: number;
  maxChunksPerEntry?: number;
  query: string;
  scope: "current" | "published";
  semantic: boolean;
  signal?: AbortSignal;
}

interface SearchIndexMatch {
  document: SearchDocument;
  rankFusionScore?: number;
  vectorDistance?: number;
}

const SEARCH_FIELDS = "title,heading,content,propertyText,headingPath,collectionPath";
const SEARCH_FIELD_WEIGHTS = "8,6,4,3,2,1";
const SEARCH_RESULT_MULTIPLIER = 4;
const SEARCH_SNIPPET_LENGTH = 360;
const getSnippet = (document: SearchDocument, query: string): string => {
  const content = document.content || document.propertyText.join(" · ");
  const normalizedQueryWords = query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 2);
  const normalizedContent = content.toLocaleLowerCase();
  const matchIndex = normalizedQueryWords.reduce((currentIndex, word) => {
    const wordIndex = normalizedContent.indexOf(word);

    if (wordIndex < 0) return currentIndex;
    if (currentIndex < 0) return wordIndex;

    return Math.min(currentIndex, wordIndex);
  }, -1);
  const start = Math.max(matchIndex - Math.floor(SEARCH_SNIPPET_LENGTH / 3), 0);
  const snippet = content.slice(start, start + SEARCH_SNIPPET_LENGTH).trim();

  return `${start > 0 ? "…" : ""}${snippet}${start + snippet.length < content.length ? "…" : ""}`;
};
const mapSearchResultItem = (document: SearchDocument, query: string): SearchResultItem => {
  const publishedFields =
    document.scope === "published"
      ? {
          channel: document.channelCode,
          versionID: document.versionID,
          snapshotID: document.snapshotID
        }
      : {};

  return {
    ...publishedFields,
    path: document.path,
    ...(document.anchor ? { anchor: document.anchor } : {}),
    ...(document.collectionPath.length > 0 && { collectionID: document.collectionID }),
    collectionPath: document.collectionPath,
    entryID: document.entryID,
    headingPath: document.headingPath,
    properties: document.propertyValues,
    snippet: getSnippet(document, query),
    title: document.title,
    updatedAt: new Date(document.updatedAt * 1000).toISOString()
  };
};
const searchDocuments = async (
  collection: string,
  parameters: TypesenseSearchParameters,
  signal?: AbortSignal
): Promise<TypesenseSearchResult<SearchDocument>> => {
  try {
    return await searchTypesenseClient.searchDocuments<SearchDocument>(
      collection,
      parameters,
      signal
    );
  } catch (error) {
    signal?.throwIfAborted();
    console.error("Search index request failed", { error });

    if (error instanceof TypesenseAPIError && [400, 422].includes(error.status)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Search filters are invalid or too complex",
        data: {
          hints: [
            "Check filter keys, operators, and value types. Reduce the number of filters to isolate the invalid condition."
          ]
        }
      });
    }

    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Search is temporarily unavailable",
      data: {
        hints: [
          "Try the read again later. If search stays unavailable, ask the instance administrator to check the search service."
        ]
      }
    });
  }
};
const searchIndex = async (input: SearchIndexInput): Promise<SearchIndexMatch[]> => {
  input.signal?.throwIfAborted();

  const collection =
    input.scope === "current" ? CURRENT_SEARCH_COLLECTION_ALIAS : PUBLISHED_SEARCH_COLLECTION_ALIAS;
  const maxChunksPerEntry = input.maxChunksPerEntry || 1;
  const groupByEntry = maxChunksPerEntry === 1;
  const [embedding] = input.semantic
    ? await searchOpenAIClient
        .createEmbeddings([input.query], input.signal)
        .catch((error: unknown) => {
          input.signal?.throwIfAborted();
          console.error("Semantic search request failed", { error });
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: "Semantic search is temporarily unavailable",
            data: {
              hints: [
                "For current or published search, set semantic to false to use text search. Ask the instance administrator to check the AI service if the problem continues."
              ]
            }
          });
        })
    : [];
  const result = await searchDocuments(
    collection,
    {
      q: input.query || "*",
      query_by: SEARCH_FIELDS,
      query_by_weights: SEARCH_FIELD_WEIGHTS,
      filter_by: buildSearchFilter(input),
      per_page: groupByEntry ? input.limit : Math.min(input.limit * SEARCH_RESULT_MULTIPLIER, 250),
      prefix: true,
      exclude_fields: "embedding",
      validate_field_names: false,
      sort_by: "_text_match:desc,updatedAt:desc",
      ...(groupByEntry && {
        group_by: "entryID",
        group_limit: 1
      }),
      ...(embedding && {
        vector_query: getVectorQuery(embedding, input.limit),
        rerank_hybrid_matches: true,
        drop_tokens_threshold: 0
      })
    },
    input.signal
  );
  const matches: SearchIndexMatch[] = [];

  input.signal?.throwIfAborted();
  const entryMatchCounts = new Map<string, number>();

  for (const hit of result.hits || []) {
    if (hit.document.scope !== input.scope) continue;
    if (!hit.document.path || (hit.document.scope === "published" && !hit.document.snapshotID)) {
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "Search metadata needs to be rebuilt",
        data: {
          hints: [
            "Ask the instance administrator to rebuild the current and published search indexes."
          ]
        }
      });
    }
    if (!matchesSearchFilters(hit.document, input.filters)) continue;

    const entryMatchCount = entryMatchCounts.get(hit.document.entryID) || 0;

    if (entryMatchCount >= maxChunksPerEntry) continue;

    matches.push({
      document: hit.document,
      rankFusionScore: hit.hybrid_search_info?.rank_fusion_score,
      vectorDistance: hit.vector_distance
    });
    entryMatchCounts.set(hit.document.entryID, entryMatchCount + 1);
  }

  if (!input.authorizeDocuments) return matches.slice(0, input.limit);

  const authorizedDocumentIDs = await input.authorizeDocuments(
    matches.map(({ document }) => document)
  );

  input.signal?.throwIfAborted();

  return matches
    .filter(({ document }) => authorizedDocumentIDs.has(document.id))
    .slice(0, input.limit);
};
function search(input: SearchIndexInput & { scope: "published" }): Promise<PublishedSearchResult>;
function search(input: SearchIndexInput): Promise<SearchResult>;
async function search(input: SearchIndexInput): Promise<SearchResult> {
  const matches = await searchIndex(input);

  return {
    results: matches.map(({ document }) => mapSearchResultItem(document, input.query))
  };
}

export { search, searchIndex, mapSearchResultItem };
export type { SearchDocumentAuthorizer, SearchIndexInput, SearchIndexMatch };
