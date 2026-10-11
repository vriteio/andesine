import { getContentFieldKey, type ContentNode } from "@andesine/document";
import { ORPCError } from "@orpc/server";
import {
  decodeBlocksMDX,
  encodeBlockMDX,
  getFieldKey,
  restoreProperty,
  type ImageAssetIDs
} from "./mdx";

interface ReplaceTextOperation {
  type: "replaceText";
  find: string;
  replace: string;
}
interface ReplaceBlockOperation {
  type: "replaceBlock";
  id: string;
  mdx: string;
}
interface InsertBlocksOperation {
  type: "insertBlocks";
  mdx: string;
  before?: string;
  after?: string;
  position?: "start" | "end";
  fragment?: string;
}
interface DeleteBlocksOperation {
  type: "deleteBlocks";
  ids: string[];
}
interface SetFieldOperation {
  type: "setField";
  key: string;
  value: unknown;
}
interface ContentBlock {
  container: ContentNode[];
  node: ContentNode;
  fragment?: string;
}
interface ContentBlockDetails {
  id: string;
  type: string;
  fragment?: string;
  mdx: string;
}

type ContentOperation =
  | ReplaceTextOperation
  | ReplaceBlockOperation
  | InsertBlocksOperation
  | DeleteBlocksOperation
  | SetFieldOperation;

const contentOperationError = (
  index: number,
  reason: "not_found" | "ambiguous",
  message: string
) => {
  return new ORPCError("CONTENT_OPERATION_INVALID", {
    status: 409,
    message: `Operation ${index}: ${message}`,
    data: {
      index,
      reason,
      hints: [
        "Read the entry again with contentFormat blocks, and use the current block IDs and text."
      ]
    }
  });
};
// Top-level blocks and the blocks of fragments; the title isn't a block.
const listBlocks = (document: ContentNode): ContentBlock[] => {
  const container = document.content || [];

  return container.flatMap((node) => {
    if (node.type === "title") return [];
    if (node.type !== "fragment") return [{ container, node }];

    const fragmentContainer = node.content || [];

    return fragmentContainer.map((child) => ({
      container: fragmentContainer,
      node: child,
      fragment: getFieldKey(node)
    }));
  });
};
const findBlock = (document: ContentNode, id: string, index: number): ContentBlock => {
  const block = listBlocks(document).find(({ node }) => node.attrs?.id === id);

  if (!block) throw contentOperationError(index, "not_found", `Block ${id} not found`);

  return block;
};
const findField = (document: ContentNode, key: string): ContentNode | undefined => {
  const keys = [getContentFieldKey("property", key), getContentFieldKey("fragment", key)];

  return document.content?.find((node) => keys.includes(getFieldKey(node) ?? ""));
};
const replaceText = async (
  document: ContentNode,
  operation: ReplaceTextOperation,
  index: number,
  imageAssetIDs?: ImageAssetIDs
): Promise<void> => {
  const blocks = listBlocks(document);
  const sources = await Promise.all(blocks.map(({ node }) => encodeBlockMDX(node)));
  const matches = sources.flatMap((source, blockIndex) => {
    return source
      .split(operation.find)
      .slice(1)
      .map(() => blockIndex);
  });

  if (!matches.length) throw contentOperationError(index, "not_found", "Text not found");

  if (matches.length > 1) {
    throw contentOperationError(
      index,
      "ambiguous",
      `Text found ${matches.length} times; include more context to match once`
    );
  }

  const { container, node } = blocks[matches[0]];
  const source = sources[matches[0]].replace(operation.find, () => operation.replace);

  container.splice(
    container.indexOf(node),
    1,
    ...(await decodeBlocksMDX(source, [node], imageAssetIDs))
  );
};
const insertBlocks = async (
  document: ContentNode,
  operation: InsertBlocksOperation,
  index: number,
  imageAssetIDs?: ImageAssetIDs
): Promise<void> => {
  const nodes = await decodeBlocksMDX(operation.mdx, [], imageAssetIDs);
  const anchorID = operation.before ?? operation.after;

  if (anchorID) {
    const { container, node } = findBlock(document, anchorID, index);
    const anchorIndex = container.indexOf(node) + (operation.after ? 1 : 0);

    container.splice(anchorIndex, 0, ...nodes);
    return;
  }

  const fragment = operation.fragment ? findField(document, operation.fragment) : undefined;

  if (operation.fragment && fragment?.type !== "fragment") {
    throw contentOperationError(index, "not_found", `Fragment ${operation.fragment} not found`);
  }

  const container = fragment ? (fragment.content ??= []) : (document.content ??= []);
  const start = !fragment && container[0]?.type === "title" ? 1 : 0;

  container.splice(operation.position === "start" ? start : container.length, 0, ...nodes);
};
const setField = async (
  document: ContentNode,
  operation: SetFieldOperation,
  index: number,
  imageAssetIDs?: ImageAssetIDs
): Promise<void> => {
  const field = findField(document, operation.key);

  if (!field) throw contentOperationError(index, "not_found", `Field ${operation.key} not found`);

  if (field.type === "property") {
    Object.assign(field, restoreProperty({ ...field, attrs: { value: operation.value } }, field));
    return;
  }

  field.content = await decodeBlocksMDX(
    String(operation.value ?? ""),
    field.content,
    imageAssetIDs
  );
};

/**
 * Applies operations in order to a copy of the document. Anchors are block IDs, unique text,
 * and field keys; a missing or ambiguous anchor fails all operations.
 * @throws CONTENT_OPERATION_INVALID with the index of the failed operation.
 */
const applyContentOperations = async (
  document: ContentNode,
  operations: ContentOperation[],
  imageAssetIDs?: ImageAssetIDs
): Promise<ContentNode> => {
  const result = structuredClone(document);

  for (const [index, operation] of operations.entries()) {
    if (operation.type === "replaceText") {
      await replaceText(result, operation, index, imageAssetIDs);
    } else if (operation.type === "replaceBlock") {
      const { container, node } = findBlock(result, operation.id, index);

      container.splice(
        container.indexOf(node),
        1,
        ...(await decodeBlocksMDX(operation.mdx, [node], imageAssetIDs))
      );
    } else if (operation.type === "insertBlocks") {
      await insertBlocks(result, operation, index, imageAssetIDs);
    } else if (operation.type === "deleteBlocks") {
      for (const id of operation.ids) {
        const { container, node } = findBlock(result, id, index);

        container.splice(container.indexOf(node), 1);
      }
    } else {
      await setField(result, operation, index, imageAssetIDs);
    }
  }

  return result;
};
/** MDX sources of operations that can hold images. */
const getOperationSources = (operations: ContentOperation[]): string[] => {
  return operations.flatMap((operation) => {
    if (operation.type === "replaceText") return [operation.replace];
    if (operation.type !== "setField") return "mdx" in operation ? [operation.mdx] : [];

    return typeof operation.value === "string" ? [operation.value] : [];
  });
};
/** The blocks of the content with their IDs and MDX, as edit operations address them. */
const getContentBlockDetails = (document: ContentNode): Promise<ContentBlockDetails[]> => {
  return Promise.all(
    listBlocks(document).map(async ({ node, fragment }) => ({
      id: String(node.attrs?.id ?? ""),
      type: node.type,
      ...(fragment && { fragment }),
      mdx: (await encodeBlockMDX(node)).trim()
    }))
  );
};

export { applyContentOperations, getContentBlockDetails, getOperationSources };
export type { ContentBlockDetails, ContentOperation };
