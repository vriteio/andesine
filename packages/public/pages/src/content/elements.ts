import type { Element } from "hast";
import { z } from "zod";

interface ContentElement {
  name: ElementName;
  props: Record<string, unknown>;
}

type ElementName = keyof typeof elementSchemas;

const noProps = z.object({}).strict();
const cardSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    icon: z.string().optional(),
    href: z.string().optional()
  })
  .strict();
/** Custom elements in Andesine content. Names and props match the MDX components. */
const elementSchemas = {
  Callout: z
    .object({
      type: z.enum(["note", "tip", "warning", "danger"]).optional(),
      title: z.string().optional()
    })
    .strict(),
  Card: cardSchema,
  CardGrid: noProps,
  CodeGroup: noProps,
  Disclosure: z.object({ title: z.string().min(1), open: z.boolean().optional() }).strict(),
  Figure: z.object({ caption: z.string().min(1) }).strict(),
  FileTree: noProps,
  // An API operation from an OpenAPI source; `id` is its operation ID.
  Operation: z
    .object({
      source: z.string().min(1),
      id: z.string().min(1),
      anchor: z.string().optional(),
      description: z.boolean().optional(),
      authentication: z.boolean().optional(),
      parameters: z.boolean().optional(),
      requestBody: z.boolean().optional(),
      responses: z.boolean().optional(),
      examples: z.boolean().optional()
    })
    .strict(),
  Steps: noProps,
  Tab: z.object({ label: z.string().min(1) }).strict(),
  Tabs: z.object({ syncKey: z.string().optional() }).strict(),
  // Content for one audience: the web page, or the Markdown outputs for agents.
  Visibility: z.object({ for: z.enum(["agents", "humans"]) }).strict()
};
/** Allowed child tags or elements, when an element restricts its children. */
const childRules: Partial<Record<ElementName, string>> = {
  CodeGroup: "pre",
  FileTree: "ul",
  Steps: "ol",
  Tabs: "Tab"
};

const getElementName = (node: Element): string | undefined => {
  const name = node.properties.dataAndesineElement;

  return typeof name === "string" ? name : undefined;
};
/** Reads and validates a custom element from the converters' HTML output. */
const readElement = (node: Element): ContentElement | undefined => {
  const name = getElementName(node);

  if (!name) return undefined;

  if (!(name in elementSchemas)) {
    throw new Error(`Unknown element <${name}>. Use ${Object.keys(elementSchemas).join(", ")}.`);
  }

  const result = elementSchemas[name as ElementName].safeParse(
    JSON.parse(String(node.properties.dataAndesineProps ?? "{}"))
  );

  if (!result.success) {
    throw new Error(`Invalid props on <${name}>:\n${z.prettifyError(result.error)}`);
  }

  const rule = childRules[name as ElementName];
  const children = node.children.filter((child) => child.type === "element");
  const invalidChild = children.find((child) => (getElementName(child) ?? child.tagName) !== rule);

  if (rule && invalidChild) throw new Error(`<${name}> can only contain ${rule} content.`);

  return { name: name as ElementName, props: result.data };
};

export { readElement };
export type { ContentElement, ElementName };
