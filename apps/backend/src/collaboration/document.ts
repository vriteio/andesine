import {
  hashContentDocument,
  replaceContentDocument,
  serializeContentDocument
} from "@andesine/server/content";
import { normalizeContentElements, type ContentNode } from "@andesine/document";
import { entryDocumentSchema } from "@andesine/document/tiptap";
import { entryName } from "@andesine/contracts/content";
import { updateYFragment } from "@tiptap/y-tiptap";
import { Doc, encodeStateAsUpdate, XmlElement, XmlText } from "yjs";
import type { ContentSnapshot, ContentState } from "./types";

const getDocumentTitle = (document: Doc): string | null => {
  const titleElement = document
    .getXmlFragment("default")
    .toArray()
    .find((node): node is XmlElement => {
      return node instanceof XmlElement && node.nodeName === "title";
    });
  const title =
    titleElement
      ?.toArray()
      .filter((node): node is XmlText => node instanceof XmlText)
      .map((node) => node.toString())
      .join("")
      .trim() || "";

  const result = entryName().safeParse(title);

  return result.success ? result.data : null;
};
const getContentSnapshot = (document: Doc): ContentSnapshot => {
  const content = normalizeContentElements(serializeContentDocument(document));

  return {
    document: content,
    hash: hashContentDocument(content)
  };
};
const setDocumentTitle = (document: Doc, title: string): void => {
  const fragment = document.getXmlFragment("default");
  let titleElement = fragment.toArray().find((node): node is XmlElement => {
    return node instanceof XmlElement && node.nodeName === "title";
  });

  if (!titleElement) {
    titleElement = new XmlElement("title");
    fragment.insert(0, [titleElement]);
  }

  const hasContentBlock = fragment
    .toArray()
    .some((node) => node instanceof XmlElement && node.nodeName !== "title");

  if (!hasContentBlock) fragment.push([new XmlElement("paragraph")]);

  const currentTitle = titleElement
    .toArray()
    .filter((node): node is XmlText => node instanceof XmlText)
    .map((node) => node.toString())
    .join("");

  if (currentTitle === title) return;

  if (titleElement.length > 0) titleElement.delete(0, titleElement.length);

  if (title) titleElement.insert(0, [new XmlText(title)]);
};

/** Changes only the differing nodes, keeping concurrent edits; throws RangeError on schema mismatch. */
const updateContentDocument = (document: Doc, content: ContentNode): void => {
  const node = entryDocumentSchema.nodeFromJSON(normalizeContentElements(content));

  updateYFragment(document, document.getXmlFragment("default"), node, {
    mapping: new Map(),
    isOMark: new Map()
  });
};
/** Like updateContentDocument, but replaces the document when the editor schema rejects it. */
const writeContentDocument = (document: Doc, content: ContentNode): void => {
  try {
    updateContentDocument(document, content);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;

    replaceContentDocument(document, content);
  }
};
// Stored as live documents store it, so hashes match live drafts.
const createContentState = (content: ContentNode): ContentState => {
  const document = new Doc();

  try {
    updateContentDocument(document, content);

    return {
      ...getContentSnapshot(document),
      state: Buffer.from(encodeStateAsUpdate(document))
    };
  } finally {
    document.destroy();
  }
};

export {
  createContentState,
  getContentSnapshot,
  getDocumentTitle,
  setDocumentTitle,
  updateContentDocument,
  writeContentDocument
};
