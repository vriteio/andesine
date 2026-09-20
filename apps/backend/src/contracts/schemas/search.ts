import { collectionSelectorShape, hasOptionalCollectionSelector } from "./paths";
import { MAX_SEARCH_RESULTS } from "#backend/lib/api/limits";
import { id, publicID } from "#backend/lib/primitives";
import { publishingChannelCodeType } from "#backend/lib/publishing/channel";
import * as z from "zod";
import { entryPropertyKindType } from "./entries";

const propertyKeyType = z.string().trim().min(1).max(100).describe("Property identifier");
const comparisonOperatorType = z.enum([
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual"
]);
const textPropertyFilterType = z.object({
  kind: z.literal("text"),
  key: propertyKeyType,
  operator: z.enum(["any", "all", "none"]).default("any"),
  values: z.array(z.string().max(500)).min(1).max(20)
});
const numberPropertyFilterType = z.object({
  kind: z.literal("number"),
  key: propertyKeyType,
  operator: comparisonOperatorType,
  value: z.number().finite()
});
const booleanPropertyFilterType = z.object({
  kind: z.literal("boolean"),
  key: propertyKeyType,
  value: z.boolean()
});
const datePropertyFilterType = z.object({
  kind: z.literal("date"),
  key: propertyKeyType,
  operator: comparisonOperatorType,
  value: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date"
  })
});
const propertyFilterType = z.discriminatedUnion("kind", [
  textPropertyFilterType,
  numberPropertyFilterType,
  booleanPropertyFilterType,
  datePropertyFilterType
]);
const propertyValueType = z.object({
  key: z.string(),
  name: z.string(),
  type: entryPropertyKindType,
  textValue: z.array(z.string()).optional(),
  numberValue: z.number().optional(),
  booleanValue: z.boolean().optional(),
  dateValue: z.number().int().optional()
});
const searchInputType = z
  .object({
    query: z.string().trim().max(500),
    ...collectionSelectorShape,
    filters: z.array(propertyFilterType).max(20).default([]),
    limit: z.number().int().min(1).max(MAX_SEARCH_RESULTS).default(20),
    semantic: z.boolean().default(false).describe("Whether to combine keyword and vector search")
  })
  .refine(hasOptionalCollectionSelector, {
    message: "Use collectionID or collectionPath, not both"
  });
const publishedSearchInputType = searchInputType.safeExtend({
  channel: publishingChannelCodeType.describe("Publishing channel to search")
});
const historyMessageType = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000)
});
const askInputType = z
  .object({
    question: z.string().trim().min(1).max(1000),
    ...collectionSelectorShape,
    filters: z.array(propertyFilterType).max(20).default([]),
    history: z.array(historyMessageType).max(10).default([])
  })
  .refine(hasOptionalCollectionSelector, {
    message: "Use collectionID or collectionPath, not both"
  });
const publishedAskInputType = askInputType.safeExtend({
  channel: publishingChannelCodeType.describe("Publishing channel to search")
});
const searchResultItemType = z.object({
  path: z.string(),
  anchor: z.string().optional(),
  entryID: id(),
  collectionID: id().optional(),
  collectionPath: z.array(z.string()),
  headingPath: z.array(z.string()),
  title: z.string(),
  snippet: z.string(),
  properties: z.array(propertyValueType),
  updatedAt: z.iso.datetime(),
  channel: publishingChannelCodeType.optional(),
  versionID: id().optional(),
  snapshotID: publicID("snp").optional()
});
const searchResultType = z.object({
  results: z.array(searchResultItemType)
});
const answerSourceType = searchResultItemType.extend({
  id: z.number().int().min(1),
  relevance: z.number().min(0).max(1)
});
const askResultType = z.object({
  answer: z.string(),
  sources: z.array(answerSourceType)
});
const publishedSearchResultItemType = searchResultItemType.extend({
  channel: publishingChannelCodeType,
  snapshotID: publicID("snp"),
  versionID: publicID("ver")
});
const publishedSearchResultType = z.object({ results: z.array(publishedSearchResultItemType) });
const publishedAnswerSourceType = publishedSearchResultItemType.extend({
  id: z.number().int().min(1),
  relevance: z.number().min(0).max(1)
});
const publishedAskResultType = z.object({
  answer: z.string(),
  sources: z.array(publishedAnswerSourceType)
});
const answerEventType = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sources"), sources: z.array(answerSourceType) }),
  z.object({ type: z.literal("textDelta"), text: z.string().min(1) }),
  askResultType.extend({ type: z.literal("completed") })
]);
const publishedAnswerEventType = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sources"), sources: z.array(publishedAnswerSourceType) }),
  z.object({ type: z.literal("textDelta"), text: z.string().min(1) }),
  publishedAskResultType.extend({ type: z.literal("completed") })
]);
export {
  answerEventType,
  publishedAnswerEventType,
  answerSourceType,
  publishedAnswerSourceType,
  publishedSearchResultItemType,
  publishedSearchResultType,
  publishedAskResultType,
  propertyKeyType,
  comparisonOperatorType,
  textPropertyFilterType,
  numberPropertyFilterType,
  booleanPropertyFilterType,
  datePropertyFilterType,
  propertyFilterType,
  propertyValueType,
  searchInputType,
  publishedSearchInputType,
  historyMessageType,
  askInputType,
  publishedAskInputType,
  searchResultItemType,
  searchResultType,
  askResultType
};
