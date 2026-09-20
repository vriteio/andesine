import { getHeadingAnchors } from "@andesine/converters/anchors";
import { normalizeProperty } from "#backend/lib/content/properties";
import { getElementData, getElementSearchText } from "@andesine/editor/element";
import { getContentBlocks, type ContentProperty } from "#backend/lib/content/blocks";
import type { ContentNode } from "#backend/lib/content/document";
import type {
  BuiltSearchDocument,
  CurrentSearchDocument,
  CurrentSearchDocumentSource,
  PublishedSearchDocument,
  PublishedSearchDocumentSource,
  SearchDocument,
  SearchDocumentSource,
  SearchPropertyValue
} from "./types";
import {
  getPropertyFilterField,
  getPropertyFilterPresenceValue,
  getTextPropertyFilterValue
} from "./query";

interface SearchContentBlock {
  anchor?: string;
  headingLevel?: number;
  resetHeading?: boolean;
  text: string;
}
interface SearchContentSection {
  anchor?: string;
  blocks: string[];
  headingPath: string[];
}
interface SearchContentChunk {
  anchor?: string;
  content: string;
  headingPath: string[];
  sectionChunkIndex: number;
  sectionIndex: number;
}
interface SearchDocumentDetails {
  chunks: SearchContentChunk[];
  propertyFilterFields: Record<string, boolean | number | string[]>;
  propertyFilterPresence: string[];
  propertyText: string[];
  propertyValues: SearchPropertyValue[];
}
interface SearchPropertyFilterDetails {
  fields: Record<string, boolean | number | string[]>;
  presence: string[];
}
interface SearchHeading {
  level: number;
  text: string;
}

const SEARCH_CHUNK_MAX_CHARACTERS = 4000;
const SEARCH_CHUNK_OVERLAP_CHARACTERS = 400;
const BLOCK_NODE_TYPES = new Set([
  "blockquote",
  "bulletList",
  "codeBlock",
  "doc",
  "fragment",
  "element",
  "hardBreak",
  "heading",
  "horizontalRule",
  "listItem",
  "orderedList",
  "paragraph",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "taskItem",
  "taskList"
]);

const normalizeText = (value: string): string => {
  return value
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
const getNodeText = (node: ContentNode): string => {
  if (node.type === "property" || node.type === "title") return "";

  const tag =
    node.type === "element" ? `${getElementSearchText(getElementData(node.attrs || {}))}\n` : "";
  const content = `${tag}${node.text || ""}${(node.content || []).map(getNodeText).join("")}`;

  return BLOCK_NODE_TYPES.has(node.type) ? `${content}\n` : content;
};
const getHeadingLevel = (node: ContentNode): number => {
  const level = node.attrs?.level;

  return typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 6
    ? level
    : 1;
};
const getSearchContentBlocks = (
  node: ContentNode,
  anchors: Map<string, { text: string; anchor: string }>,
  headingParents: Set<string>,
  path: number[] = []
): SearchContentBlock[] => {
  const children = () => {
    return (node.content || []).flatMap((child, index) => {
      return getSearchContentBlocks(child, anchors, headingParents, [...path, index]);
    });
  };
  if (node.type === "property" || node.type === "title") return [];

  if (node.type === "heading") {
    const heading = anchors.get(path.join("."));

    return heading
      ? [
          {
            headingLevel: getHeadingLevel(node),
            text: normalizeText(getNodeText(node)),
            anchor: heading.anchor
          }
        ]
      : [];
  }

  if (node.type === "element") {
    return [{ text: getElementSearchText(getElementData(node.attrs || {})) }, ...children()];
  }

  if (node.type === "fragment") {
    return [{ resetHeading: true, text: "" }, ...children(), { resetHeading: true, text: "" }];
  }

  if (node.type === "doc") {
    return children();
  }

  if (headingParents.has(path.join("."))) return children();

  const text = normalizeText(getNodeText(node));

  return text ? [{ text }] : [];
};
const formatPropertyText = (property: ContentProperty): string => {
  const value = Array.isArray(property.value) ? property.value.join(", ") : property.value;

  return value === null || value === "" ? property.name : `${property.name}: ${String(value)}`;
};
const getPropertyFilterFields = (
  properties: SearchPropertyValue[]
): SearchPropertyFilterDetails => {
  const fields: Record<string, boolean | number | string[]> = {};
  const presence: string[] = [];
  const setField = (
    kind: "boolean" | "date" | "number" | "text",
    key: string,
    value: boolean | number | string[]
  ) => {
    fields[getPropertyFilterField(kind, key)] = value;
    presence.push(getPropertyFilterPresenceValue(kind, key));
  };

  for (const property of properties) {
    if (property.numberValue !== undefined) {
      setField("number", property.key, property.numberValue);
    } else if (property.booleanValue !== undefined) {
      setField("boolean", property.key, property.booleanValue);
    } else if (property.dateValue !== undefined) {
      setField("date", property.key, property.dateValue);
    } else if (property.textValue !== undefined) {
      setField("text", property.key, [
        "present:",
        ...property.textValue.map(getTextPropertyFilterValue)
      ]);
    }
  }

  return { fields, presence };
};
const getSearchDocumentDetails = (
  content: ContentNode,
  sourceProperties?: Record<string, ContentProperty>
): SearchDocumentDetails => {
  const properties = sourceProperties || getContentBlocks(content).properties;
  const propertyEntries = Object.entries(properties);
  const propertyValues = propertyEntries.map(([key, property]) => normalizeProperty(key, property));
  const propertyFilterDetails = getPropertyFilterFields(propertyValues);

  return {
    chunks: getSearchContentChunks(content),
    propertyFilterFields: propertyFilterDetails.fields,
    propertyFilterPresence: propertyFilterDetails.presence,
    propertyText: propertyEntries.map(([, property]) => formatPropertyText(property)),
    propertyValues
  };
};
const findChunkEnd = (content: string, start: number): number => {
  const maximumEnd = Math.min(start + SEARCH_CHUNK_MAX_CHARACTERS, content.length);

  if (maximumEnd === content.length) return maximumEnd;

  const minimumEnd = start + Math.floor(SEARCH_CHUNK_MAX_CHARACTERS / 2);
  const paragraphEnd = content.lastIndexOf("\n", maximumEnd);

  if (paragraphEnd >= minimumEnd) return paragraphEnd;

  const wordEnd = content.lastIndexOf(" ", maximumEnd);

  return wordEnd >= minimumEnd ? wordEnd : maximumEnd;
};
const splitSearchContent = (content: string): string[] => {
  if (!content) return [""];

  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    const end = findChunkEnd(content, start);
    const chunk = content.slice(start, end).trim();

    if (chunk) chunks.push(chunk);
    if (end === content.length) break;

    start = Math.max(end - SEARCH_CHUNK_OVERLAP_CHARACTERS, start + 1);

    while (start < end && !/\s/.test(content[start] || "")) {
      start += 1;
    }
  }

  return chunks.length > 0 ? chunks : [""];
};
const getSearchContentSections = (content: ContentNode): SearchContentSection[] => {
  const headings = getHeadingAnchors(content);
  const anchors = new Map(headings.map((heading) => [heading.path.join("."), heading]));
  const headingParents = new Set(
    headings.flatMap(({ path }) => {
      return path.map((_, index) => path.slice(0, index).join("."));
    })
  );
  const contentBlocks = getSearchContentBlocks(content, anchors, headingParents);
  const headingPath: SearchHeading[] = [];
  const sections: SearchContentSection[] = [];
  let section: SearchContentSection = { blocks: [], headingPath: [] };

  for (const block of contentBlocks) {
    if (block.resetHeading) {
      if (section.blocks.length > 0 || section.anchor) sections.push(section);

      headingPath.length = 0;
      section = { blocks: [], headingPath: [] };
      continue;
    }

    if (block.headingLevel) {
      if (section.blocks.length > 0 || section.anchor) sections.push(section);

      while (
        headingPath.length > 0 &&
        headingPath[headingPath.length - 1]!.level >= block.headingLevel
      ) {
        headingPath.pop();
      }

      headingPath.push({ level: block.headingLevel, text: block.text });
      section = {
        blocks: [],
        headingPath: headingPath.map(({ text }) => text),
        anchor: block.anchor
      };
      continue;
    }

    section.blocks.push(block.text);
  }

  if (section.blocks.length > 0 || section.headingPath.length > 0 || sections.length === 0) {
    sections.push(section);
  }

  return sections;
};
const getSearchContentChunks = (content: ContentNode): SearchContentChunk[] => {
  return getSearchContentSections(content).flatMap((section, sectionIndex) => {
    return splitSearchContent(section.blocks.join("\n")).map((chunk, sectionChunkIndex) => ({
      content: chunk,
      anchor: section.anchor,
      headingPath: section.headingPath,
      sectionChunkIndex,
      sectionIndex
    }));
  });
};
const getSearchDocumentID = (source: SearchDocumentSource, chunkIndex: number): string => {
  if (source.scope === "published") {
    return `${source.channelID}-${source.entryID}-${chunkIndex}`;
  }

  return `${source.entryID}-${chunkIndex}`;
};
const getEmbeddingText = (
  title: string,
  content: string,
  headingPath: string[],
  propertyText: string[],
  collectionPath: string[]
): string => {
  return normalizeText(
    [title, collectionPath.join(" / "), headingPath.join(" > "), ...propertyText, content].join(
      "\n"
    )
  );
};
const buildSearchDocuments = <TDocument extends SearchDocument>(
  source: SearchDocumentSource
): Array<BuiltSearchDocument<TDocument>> => {
  const details = getSearchDocumentDetails(source.content, source.properties);
  const ancestorCollectionIDs = source.ancestorCollectionIDs || [];
  const restrictedBoundaryIDs = source.restrictedBoundaryIDs || [];
  const collectionPath = source.collectionPath || [];
  const updatedAt = Math.floor(source.updatedAt.getTime() / 1000);

  return details.chunks.map((chunk, chunkIndex) => {
    const heading = chunk.headingPath[chunk.headingPath.length - 1] || "";
    const baseDocument = {
      id: getSearchDocumentID(source, chunkIndex),
      path: source.path,
      ...(chunk.anchor ? { anchor: chunk.anchor } : {}),
      workspaceID: source.workspaceID,
      entryID: source.entryID,
      collectionID: source.collectionID,
      ancestorCollectionIDs,
      restrictedBoundaryIDs,
      collectionPath,
      title: source.title,
      heading,
      headingPath: chunk.headingPath,
      content: chunk.content,
      propertyText: details.propertyText,
      propertyValues: details.propertyValues,
      propertyFilterPresence: details.propertyFilterPresence,
      ...details.propertyFilterFields,
      chunkIndex,
      chunkCount: details.chunks.length,
      sectionIndex: chunk.sectionIndex,
      sectionChunkIndex: chunk.sectionChunkIndex,
      updatedAt
    };
    const document =
      source.scope === "published"
        ? {
            ...baseDocument,
            scope: source.scope,
            channelID: source.channelID,
            channelCode: source.channelCode,
            snapshotID: source.snapshotID,
            versionID: source.versionID
          }
        : { ...baseDocument, scope: source.scope };

    return {
      document: document as TDocument,
      embeddingText: getEmbeddingText(
        source.title,
        chunk.content,
        chunk.headingPath,
        details.propertyText,
        collectionPath
      )
    };
  });
};
const buildCurrentSearchDocuments = (
  source: CurrentSearchDocumentSource
): Array<BuiltSearchDocument<CurrentSearchDocument>> => {
  return buildSearchDocuments<CurrentSearchDocument>(source);
};
const buildPublishedSearchDocuments = (
  source: PublishedSearchDocumentSource
): Array<BuiltSearchDocument<PublishedSearchDocument>> => {
  return buildSearchDocuments<PublishedSearchDocument>(source);
};

export { buildCurrentSearchDocuments, buildPublishedSearchDocuments };
