import type { z } from "zod";
import type {
  textPropertyFilterType,
  numberPropertyFilterType,
  booleanPropertyFilterType,
  datePropertyFilterType,
  propertyFilterType
} from "../api/schemas/search";

type TextPropertyFilter = z.infer<typeof textPropertyFilterType>;
type NumberPropertyFilter = z.infer<typeof numberPropertyFilterType>;
type BooleanPropertyFilter = z.infer<typeof booleanPropertyFilterType>;
type DatePropertyFilter = z.infer<typeof datePropertyFilterType>;
type PropertyFilter = z.infer<typeof propertyFilterType>;

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
} from "../api/schemas/search";

export type {
  TextPropertyFilter,
  NumberPropertyFilter,
  BooleanPropertyFilter,
  DatePropertyFilter,
  PropertyFilter
};
