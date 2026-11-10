import { contentNodeType } from "@andesine/document";
import { contentSchemaMetadataType } from "../../schema/recorded";
import { entryType } from "../../entities/entries";
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
const entrySummaryType = entryType.extend({ path: z.string(), slugPath: z.string() });
const entryReferenceType = z
  .discriminatedUnion("available", [
    z.object({
      id: z.string(),
      available: z.literal(true),
      path: z.string(),
      slugPath: z.string(),
      title: z.string(),
      collectionID: z.string().nullable()
    }),
    z.object({ id: z.string(), available: z.literal(false) })
  ])
  .describe("Linked entry; deleted and unreadable entries are unavailable");
const entryReferencesType = z
  .record(z.string(), entryReferenceType)
  .describe("Entries linked with entry: links in the content, by entry ID");
const entryDetailsType = entrySummaryType.extend({
  schema: contentSchemaMetadataType.nullable(),
  updatedAt: z.iso.datetime().describe("Time when the entry content was last updated"),
  hash: z.string().length(64).describe("Hash of the current content, comparable to version hashes"),
  content: contentNodeType,
  fragments: z.record(z.string(), entryFragmentType),
  properties: z.record(z.string(), entryPropertyType)
});
const entryListType = z.object({
  data: z.array(entrySummaryType),
  pagination: paginationType
});

export {
  entryReferencesType,
  entrySummaryType,
  entryFragmentType,
  entryPropertyKindType,
  entryPropertyValueType,
  entryPropertyType,
  entryDetailsType,
  entryListType
};
