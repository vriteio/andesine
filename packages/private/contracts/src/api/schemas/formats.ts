import * as z from "zod";
import { entryPropertyValueType } from "./entries";

const contentFormatType = z
  .enum(["json", "mdx"])
  .default("json")
  .describe("Content format of the response; mdx also returns the content as MDX in mdx");
const mdxContentType = z
  .string()
  .describe(
    "Content as MDX: the title as H1, properties as <Property name value /> elements in place, fragments as <Fragment name> elements, and images as asset:<assetID>; frontmatter properties are also read, and entries.update and versions.create import image URLs"
  );

const entryContentFormatType = z
  .enum(["json", "mdx", "blocks"])
  .default("json")
  .describe(
    "Content format of the response; mdx also returns the content as MDX in mdx, and blocks returns the blocks that edit operations address in blocks"
  );
const contentBlockType = z.object({
  id: z.string().describe("Block ID for replaceBlock, insertBlocks, and deleteBlocks"),
  type: z.string().describe("Node type of the block"),
  fragment: z.string().optional().describe("Key of the fragment that contains the block"),
  mdx: mdxContentType
});
const mdxBlocksType = z.string().describe("Blocks as MDX, without a title");
const fieldValueType = entryPropertyValueType.describe("Property value, or MDX for a fragment");
const contentOperationType = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("replaceText"),
      find: z.string().min(1).describe("Text that occurs exactly once in the MDX of one block"),
      replace: z.string().describe("Replacement text")
    })
    .describe("Replace text in one block"),
  z
    .object({ type: z.literal("replaceBlock"), id: z.string(), mdx: mdxBlocksType })
    .describe("Replace a block with zero or more blocks"),
  z
    .object({
      type: z.literal("insertBlocks"),
      mdx: mdxBlocksType,
      before: z.string().optional().describe("ID of the block to insert before"),
      after: z.string().optional().describe("ID of the block to insert after"),
      position: z.enum(["start", "end"]).optional().describe("Insert at the start or the end"),
      fragment: z.string().optional().describe("Fragment key for position")
    })
    .refine(
      (operation) =>
        [operation.before, operation.after, operation.position].filter(Boolean).length === 1,
      { message: "Use one of before, after, or position" }
    )
    .describe("Insert blocks"),
  z
    .object({ type: z.literal("deleteBlocks"), ids: z.array(z.string()).min(1) })
    .describe("Delete blocks"),
  z
    .object({
      type: z.literal("setField"),
      key: z.string().describe("Field name or key"),
      value: fieldValueType
    })
    .describe("Set a property value or the content of a fragment")
]);

export {
  contentBlockType,
  contentFormatType,
  contentOperationType,
  entryContentFormatType,
  fieldValueType,
  mdxContentType
};
