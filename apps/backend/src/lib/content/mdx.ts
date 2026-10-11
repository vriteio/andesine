import { ConversionError, type ContentNode } from "@andesine/converters";
import { fromMDX, toMDX, type MDXOptions } from "@andesine/converters/mdx";
import {
  FRAGMENT_ELEMENT_NAME,
  getContentFieldKey,
  PROPERTY_ELEMENT_NAME
} from "@andesine/document";
import { ORPCError } from "@orpc/server";

interface EncodeEntryMDXOptions {
  imageURL?: MDXOptions["imageURL"];
}
interface MDXParseError {
  line?: number;
  column?: number;
  reason?: string;
}

type ImageAssetIDs = Map<string, string>;

const ASSET_URL_PREFIX = "asset:";
const IMAGE_LAYOUT_ATTRIBUTES = ["aspectRatio", "size"];
const mdxOptions: MDXOptions = {
  properties: { as: "element", name: PROPERTY_ELEMENT_NAME },
  fragments: { default: { as: "element", name: FRAGMENT_ELEMENT_NAME } }
};

const getFieldKey = (node: ContentNode): string | undefined => {
  if (node.type === "property") return getContentFieldKey("property", node.attrs?.label);
  if (node.type === "fragment") return getContentFieldKey("fragment", node.attrs?.name);
};
const isSchemaField = (node: ContentNode): boolean => {
  return typeof node.attrs?.schemaFieldID === "string";
};
const encodeBlock = (node: ContentNode): Promise<string> => {
  return toMDX(
    { type: "doc", content: [node] },
    {
      ...mdxOptions,
      title: "omit",
      imageURL: (image) => `${ASSET_URL_PREFIX}${String(image.attrs?.assetID)}`
    }
  );
};
const getCommonBlocks = (keys: string[], baseKeys: string[]): Array<[number, number]> => {
  const lengths = keys.map(() => Array<number>(baseKeys.length + 1).fill(0));
  const pairs: Array<[number, number]> = [];

  lengths.push(Array<number>(baseKeys.length + 1).fill(0));

  for (let index = keys.length - 1; index >= 0; index -= 1) {
    for (let baseIndex = baseKeys.length - 1; baseIndex >= 0; baseIndex -= 1) {
      lengths[index][baseIndex] =
        keys[index] === baseKeys[baseIndex]
          ? lengths[index + 1][baseIndex + 1] + 1
          : Math.max(lengths[index + 1][baseIndex], lengths[index][baseIndex + 1]);
    }
  }

  for (let index = 0, baseIndex = 0; index < keys.length && baseIndex < baseKeys.length;) {
    if (keys[index] === baseKeys[baseIndex]) {
      pairs.push([index, baseIndex]);
      index += 1;
      baseIndex += 1;
    } else if (lengths[index + 1][baseIndex] >= lengths[index][baseIndex + 1]) {
      index += 1;
    } else {
      baseIndex += 1;
    }
  }

  return pairs;
};
const restoreChangedBlock = async (node: ContentNode, base: ContentNode): Promise<ContentNode> => {
  const sameField = getFieldKey(node) !== undefined && getFieldKey(node) === getFieldKey(base);

  if (node.type === "property" && sameField) {
    return restoreProperty(node, base);
  }

  const sameImage = node.type === "image" && node.attrs?.assetID === base.attrs?.assetID;
  const sameFragment = node.type === "fragment" && sameField;
  const layout = sameImage
    ? Object.fromEntries(IMAGE_LAYOUT_ATTRIBUTES.map((name) => [name, base.attrs?.[name]]))
    : {};
  const attrs = sameFragment ? base.attrs : { ...node.attrs, ...layout, id: base.attrs?.id };
  const content =
    node.type === "fragment"
      ? await restoreBlocks(node.content || [], base.content || [])
      : node.content;

  return { ...node, attrs, content };
};
/**
 * Reuses base blocks with the same MDX, so unchanged blocks keep their IDs and attributes
 * that MDX can't hold. Changed blocks take the ID of a base block of the same type in their gap.
 */
const restoreBlocks = async (
  nodes: ContentNode[],
  baseNodes: ContentNode[]
): Promise<ContentNode[]> => {
  const keys = await Promise.all(nodes.map(encodeBlock));
  const baseKeys = await Promise.all(baseNodes.map(encodeBlock));
  const pairs = getCommonBlocks(keys, baseKeys);
  const used = new Set(pairs.map(([, baseIndex]) => baseNodes[baseIndex]));
  const restored: ContentNode[] = [];
  // Fields match by key anywhere, because frontmatter properties lose their position.
  const findField = (node: ContentNode): ContentNode | undefined => {
    const key = getFieldKey(node);

    return baseNodes.find((base) => !used.has(base) && key && getFieldKey(base) === key);
  };

  let index = 0;
  let baseIndex = 0;

  for (const [pairIndex, pairBaseIndex] of [...pairs, [nodes.length, baseNodes.length]]) {
    const gapBase = baseNodes.slice(baseIndex, pairBaseIndex);
    const gapNodes = nodes.slice(index, pairIndex);

    // MDX has no empty blocks (for example the trailing paragraph); keep them where nothing changed.
    if (!gapNodes.length) {
      restored.push(...gapBase.filter((_base, offset) => !baseKeys[baseIndex + offset].trim()));
    }

    for (const node of gapNodes) {
      const base =
        findField(node) ??
        gapBase.find((gapNode) => !used.has(gapNode) && gapNode.type === node.type);

      if (base) used.add(base);

      restored.push(base ? await restoreChangedBlock(node, base) : node);
    }

    if (pairIndex < nodes.length) restored.push(baseNodes[pairBaseIndex]);

    index = pairIndex + 1;
    baseIndex = pairBaseIndex + 1;
  }

  return restored;
};
const restoreProperty = (node: ContentNode, base: ContentNode): ContentNode => {
  const value = node.attrs?.value ?? "";
  // Numbers can be stored as text; keep the stored value when it is the same number.
  const sameValue = JSON.stringify(value) === JSON.stringify(base.attrs?.value);
  const sameNumber = base.attrs?.type === "number" && String(value) === String(base.attrs?.value);

  return {
    ...base,
    attrs: { ...base.attrs, value: sameValue || sameNumber ? base.attrs?.value : value }
  };
};
/**
 * Rebuilds what MDX doesn't hold from the base document: field attributes by key, schema fields
 * left out of the MDX, and the IDs and attributes of unchanged blocks.
 */
const restoreContent = async (document: ContentNode, base: ContentNode): Promise<ContentNode> => {
  const [title, ...nodes] = document.content || [];
  const baseNodes = (base.content || []).filter((node) => node.type !== "title");
  const fields = new Map(nodes.filter(getFieldKey).map((node) => [getFieldKey(node)!, node]));
  const schemaFields = baseNodes.filter(isSchemaField);

  if (!schemaFields.length) {
    return { ...document, content: [title, ...(await restoreBlocks(nodes, baseNodes))] };
  }

  const restoredFields: ContentNode[] = [];

  for (const base of schemaFields) {
    const node = fields.get(getFieldKey(base)!);

    fields.delete(getFieldKey(base)!);

    if (!node) {
      restoredFields.push(base);
    } else if (base.type === "property") {
      restoredFields.push(restoreProperty(node, base));
    } else {
      restoredFields.push({
        ...base,
        content: await restoreBlocks(node.content || [], base.content || [])
      });
    }
  }

  // Unknown fields and blocks outside fragments stay, so the schema check reports them.
  return {
    ...document,
    content: [
      title,
      ...restoredFields,
      ...nodes.filter((node) => !getFieldKey(node) || fields.has(getFieldKey(node)!))
    ]
  };
};
/** Resolves `asset:<assetID>` references, and image URLs imported before the write. */
const createAssetIDResolver = (imageAssetIDs: ImageAssetIDs = new Map()) => {
  return ({ url }: { url: string }): string => {
    const importedID = imageAssetIDs.get(url);

    if (url.startsWith(ASSET_URL_PREFIX)) return url.slice(ASSET_URL_PREFIX.length);
    if (importedID) return importedID;

    throw new ConversionError(
      `Image ${url} can't be imported here; use ${ASSET_URL_PREFIX}<assetID>, or add images by URL with entries.update after the entry exists`
    );
  };
};
const contentFormatInvalidError = (error: unknown) => {
  const { line, column, reason } = error as MDXParseError;
  const message = reason || (error instanceof Error ? error.message : "Invalid MDX");

  return new ORPCError("CONTENT_FORMAT_INVALID", {
    status: 400,
    message: `Invalid MDX: ${message}`,
    data: {
      ...(typeof line === "number" && { line }),
      ...(typeof column === "number" && { column }),
      hints: [
        "In text, escape < and { with a backslash. Comments ({/* */} and <!-- -->) aren't supported.",
        "Write fields as <Property name value /> and <Fragment name> elements, as entries.get returns them."
      ]
    }
  });
};

/** Exports entry content as MDX: the title as H1, and properties and fragments as elements. */
const encodeEntryMDX = (
  document: ContentNode,
  options: EncodeEntryMDXOptions = {}
): Promise<string> => {
  return toMDX(document, {
    ...mdxOptions,
    imageURL: options.imageURL ?? ((image) => `${ASSET_URL_PREFIX}${String(image.attrs?.assetID)}`)
  });
};
/**
 * Imports MDX as entry content, restoring what MDX doesn't hold from the base document.
 * @throws CONTENT_FORMAT_INVALID for invalid MDX, frontmatter, or images.
 */
const decodeEntryMDX = async (
  source: string,
  base: ContentNode,
  imageAssetIDs?: ImageAssetIDs
): Promise<ContentNode> => {
  let document: ContentNode;

  try {
    document = await fromMDX(source, {
      ...mdxOptions,
      imageAssetID: createAssetIDResolver(imageAssetIDs)
    });
  } catch (error) {
    throw contentFormatInvalidError(error);
  }

  return restoreContent(document, base);
};

/**
 * Imports MDX blocks without a title, restoring IDs and attributes from the blocks they replace.
 * @throws CONTENT_FORMAT_INVALID for invalid MDX, frontmatter, or images.
 */
const decodeBlocksMDX = async (
  source: string,
  baseBlocks: ContentNode[] = [],
  imageAssetIDs?: ImageAssetIDs
): Promise<ContentNode[]> => {
  let document: ContentNode;

  try {
    document = await fromMDX(source, {
      ...mdxOptions,
      document: "fragment",
      imageAssetID: createAssetIDResolver(imageAssetIDs)
    });
  } catch (error) {
    throw contentFormatInvalidError(error);
  }

  return restoreBlocks(document.content || [], baseBlocks);
};

/** Sources that don't parse are skipped; decoding reports them. */
const getMDXImageURLs = async (sources: string[]): Promise<string[]> => {
  const urls = new Set<string>();

  for (const source of sources) {
    await fromMDX(source, {
      ...mdxOptions,
      document: "fragment",
      imageAssetID: ({ url }) => {
        if (!url.startsWith(ASSET_URL_PREFIX)) urls.add(url);

        return url;
      }
    }).catch(() => undefined);
  }

  return [...urls];
};

export {
  decodeBlocksMDX,
  getMDXImageURLs,
  decodeEntryMDX,
  encodeBlock as encodeBlockMDX,
  encodeEntryMDX,
  getFieldKey,
  restoreProperty
};
export type { ImageAssetIDs };
