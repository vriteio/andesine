import type { ToolContext } from "./context";

type CustomElement = Awaited<
  ReturnType<ToolContext["client"]["extensions"]["listElements"]>
>[number];
type ElementChild = CustomElement["children"][number];

const BLOCK_NAMES: Record<string, string> = {
  paragraph: "paragraphs",
  heading: "headings",
  blockquote: "quotes",
  bulletList: "bullet lists",
  orderedList: "numbered lists",
  taskList: "task lists",
  horizontalRule: "dividers",
  codeBlock: "code blocks",
  table: "tables",
  image: "images"
};

/** The element's tag with the props of a new one, e.g. `<Tab label="Tab">…</Tab>`. */
const formatTag = (element: ElementChild): string => {
  const props = (element.props ?? []).flatMap(({ name, default: value }) => {
    if (value === undefined) return [];

    return typeof value === "string" ? `${name}="${value}"` : `${name}={${JSON.stringify(value)}}`;
  });
  const attributes = props.length ? ` ${props.join(" ")}` : "";

  return element.content
    ? `<${element.element}${attributes}>…</${element.element}>`
    : `<${element.element}${attributes} />`;
};
const formatProps = (element: ElementChild): string[] => {
  return (element.props ?? []).map((field) => {
    const options = "enum" in field ? field.enum : undefined;
    const details = [
      field.type,
      ...(options ? [`one of ${options.map((value) => `"${value}"`).join(", ")}`] : []),
      ...(field.default === undefined ? [] : [`default ${JSON.stringify(field.default)}`])
    ];
    const description = field.description ?? field.title;

    return `  - \`${field.name}\` (${details.join(", ")})${description ? `: ${description}` : ""}`;
  });
};
const formatBlocks = (list: NonNullable<ElementChild["accepts"]>) => {
  const names = [
    ...(list.elements ?? []).map((name) => `<${name}>`),
    ...(list.blocks ?? []).map((block) => BLOCK_NAMES[block] ?? block)
  ];

  return new Intl.ListFormat("en", { type: "disjunction" }).format(names);
};
const formatContent = (element: ElementChild): string => {
  const rejects = element.rejects ? ` Not ${formatBlocks(element.rejects)}.` : "";

  if (!element.content) return "No content; write it self-closing.";
  if (!element.accepts) return `Any blocks.${rejects}`;

  return `Only ${formatBlocks(element.accepts)}, directly inside it.${rejects}`;
};
const formatElement = (element: ElementChild, heading: string): string[] => {
  const props = formatProps(element);

  return [
    heading,
    "",
    ...(element.description ? [element.description, ""] : []),
    `- Write: \`${formatTag(element)}\``,
    `- Content: ${formatContent(element)}`,
    ...(props.length ? ["- Props:", ...props] : []),
    ""
  ];
};
/** A Markdown guide to the workspace's custom elements, for agents that write MDX. */
const formatElementsGuide = (elements: CustomElement[]): string => {
  const sections = elements.flatMap((element) => [
    ...formatElement(element, `## ${element.name}: <${element.element}> (${element.extension})`),
    ...element.children.flatMap((child) => {
      return formatElement(child, `### <${child.element}>, inside <${element.element}>`);
    })
  ]);

  return [
    "# Custom elements",
    "",
    "Elements that the workspace's extensions draw in the editor. Write them as in andesine://guide/mdx, and follow each element's content rules: the editor marks content that doesn't fit and offers to clean it up.",
    "",
    ...(sections.length ? sections : ["No custom elements, or no access to them."])
  ].join("\n");
};

export { formatElementsGuide };
