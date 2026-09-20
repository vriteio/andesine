import { contentSchemaMetadataType } from "#backend/lib/schema/contract/recorded";
import { entryType } from "#backend/db/entries";
import { contentNodeType } from "#backend/lib/content/validation";
import * as z from "zod";
import { paginationType } from "./pagination";

const entryFragmentType = z.object({
  name: z.string().describe("Source fragment name"),
  content: contentNodeType
});
const entryPropertyKindType = z.enum([
  "text",
  "number",
  "checkbox",
  "date",
  "url",
  "select",
  "multi-select"
]);
const entryPropertyValueType = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]);
const entryPropertyType = z.object({
  name: z.string().describe("Source property name"),
  type: entryPropertyKindType.describe("Property type"),
  value: entryPropertyValueType
});
const entrySummaryType = entryType.extend({ path: z.string() });
const entryDetailsType = entrySummaryType.extend({
  schema: contentSchemaMetadataType.nullable(),
  updatedAt: z.iso.datetime().describe("Time when the entry content was last updated"),
  content: contentNodeType,
  fragments: z.record(z.string(), entryFragmentType),
  properties: z.record(z.string(), entryPropertyType)
});
const entryListType = z.object({
  data: z.array(entrySummaryType),
  pagination: paginationType
});

export {
  entrySummaryType,
  entryFragmentType,
  entryPropertyKindType,
  entryPropertyValueType,
  entryPropertyType,
  entryDetailsType,
  entryListType
};
