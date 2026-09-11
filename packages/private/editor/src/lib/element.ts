interface ElementData {
  name: string;
  props: Record<string, ElementValue>;
  selfClosing: boolean;
}
interface ElementToken {
  from: number;
  to: number;
  kind:
    | "name"
    | "attribute"
    | "property"
    | "string"
    | "number"
    | "literal"
    | "operator"
    | "punctuation";
}
interface ElementContent {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ElementContent[];
}

type ElementValue =
  string | number | boolean | null | ElementValue[] | { [key: string]: ElementValue };

const ELEMENT_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
const ELEMENT_TAG_NAME = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/;
const getElementTagName = (source: string): string => {
  return /^\s*<([A-Za-z][A-Za-z0-9_.-]*)?/.exec(source)?.[1] || "";
};
const OBJECT_KEY = /^[$_\p{ID_Start}][$\u200c\u200d_\p{ID_Continue}]*$/u;
const parseElementValue = (source: string): ElementValue => {
  const json = source.replace(
    /"(?:\\[\s\S]|[^"\\])*"|[$_\p{ID_Start}][$\u200c\u200d_\p{ID_Continue}]*/gu,
    (token, offset: number) => {
      if (!token.startsWith('"') && /^\s*:/.test(source.slice(offset + token.length))) {
        return JSON.stringify(token);
      }
      return token;
    }
  );

  return JSON.parse(json);
};
const ELEMENT_BLOCKS = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "horizontalRule",
  "codeBlock",
  "table",
  "image",
  "element"
];
const ELEMENT_STRUCTURE = [
  "listItem",
  "taskItem",
  "tableRow",
  "tableCell",
  "tableHeader",
  "text",
  "hardBreak"
];
const isElementValue = (value: unknown): value is ElementValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return Array.from(value).every(isElementValue);
  }
  if (
    !value ||
    typeof value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    return false;
  }

  return Object.values(value).every(isElementValue);
};
const getElementData = (attrs: Record<string, unknown>): ElementData => {
  const { name, props, selfClosing } = attrs;

  if (typeof name !== "string" || !ELEMENT_TAG_NAME.test(name)) {
    throw new Error("Invalid Element name");
  }
  if (!props || Array.isArray(props) || typeof props !== "object" || !isElementValue(props)) {
    throw new Error("Element props must be a JSON object");
  }
  if (Object.keys(props).some((key) => !ELEMENT_NAME.test(key))) {
    throw new Error("Invalid Element prop name");
  }
  if (typeof selfClosing !== "boolean") {
    throw new Error("Invalid Element closing state");
  }

  return { name, props: props as ElementData["props"], selfClosing };
};
const parseElement = (source: string): ElementData => {
  const props: ElementData["props"] = {};
  const fail = (): never => {
    throw new Error("Invalid opening tag");
  };
  let position = 0;

  const whitespace = () => {
    while (/\s/.test(source[position] || "") && position < source.length) {
      position += 1;
    }
  };
  const identifier = (tag = false): string => {
    const start = position;

    while (
      (tag ? /[A-Za-z0-9_.-]/ : /[A-Za-z0-9_-]/).test(source[position] || "") &&
      position < source.length
    ) {
      position += 1;
    }

    const value = source.slice(start, position);

    if (!(tag ? ELEMENT_TAG_NAME : ELEMENT_NAME).test(value)) {
      fail();
    }
    return value;
  };
  const quoted = (): string => {
    const start = position++;
    let escaped = false;

    while (position < source.length) {
      const character = source[position++];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(source.slice(start, position));
      }
    }

    return fail();
  };

  whitespace();
  if (source[position++] !== "<") {
    fail();
  }

  const name = identifier(true);

  while (position < source.length) {
    const beforeSpace = position;

    whitespace();
    if (source[position] === ">" || source.slice(position, position + 2) === "/>") {
      break;
    }
    if (position === beforeSpace) {
      fail();
    }

    const key = identifier();
    let value: ElementValue = true;
    const afterKey = position;

    whitespace();
    if (source[position] === "=") {
      position += 1;
      whitespace();

      if (source[position] === '"') {
        value = quoted();
      } else if (source[position] === "{") {
        const start = ++position;
        const delimiters = ["}"];

        while (position < source.length && delimiters.length) {
          const character = source[position];

          if (character === '"') {
            quoted();
            continue;
          }
          if (character === "{") {
            delimiters.push("}");
          }
          if (character === "[") {
            delimiters.push("]");
          }
          if (character === "}" || character === "]") {
            if (delimiters.pop() !== character) {
              fail();
            }
            if (!delimiters.length) {
              break;
            }
          }

          position += 1;
        }

        if (delimiters.length || source[position] !== "}") {
          fail();
        }
        value = parseElementValue(source.slice(start, position));
        position += 1;
      } else {
        fail();
      }
    } else {
      position = afterKey;
    }

    if (Object.prototype.hasOwnProperty.call(props, key)) {
      throw new Error(`Duplicate prop "${key}"`);
    }
    Object.defineProperty(props, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }

  const selfClosing = source.slice(position, position + 2) === "/>";

  if (source[position] !== ">" && !selfClosing) {
    fail();
  }
  position += selfClosing ? 2 : 1;
  whitespace();
  if (position !== source.length) {
    fail();
  }

  return getElementData({ name, props, selfClosing });
};
const canonicalElementValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalElementValue).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalElementValue(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
};
const formatElement = (data: ElementData, width = 80): string => {
  const closing = data.selfClosing ? " />" : ">";
  const formatProp = (key: string, value: ElementValue, multiline = false): string => {
    const json = JSON.stringify(value, null, multiline ? 2 : undefined).replace(
      /"(?:\\[\s\S]|[^"\\])*"/g,
      (token, offset: number, source: string) => {
        const key = JSON.parse(token) as string;

        return OBJECT_KEY.test(key) && /^\s*:/.test(source.slice(offset + token.length))
          ? key
          : token;
      }
    );

    if (value === true) {
      return key;
    }
    if (typeof value === "string" && !/[\n\r"\\]/.test(value)) {
      return `${key}=${json}`;
    }
    return `${key}={${json}}`;
  };
  const entries = Object.entries(data.props);
  const hasStructuredValues = entries.some(
    ([, value]) => value !== null && typeof value === "object" && Object.keys(value).length > 0
  );
  const compact = `<${data.name}${entries.map(([key, value]) => ` ${formatProp(key, value)}`).join("")}${closing}`;

  if ((!hasStructuredValues && compact.length <= width) || !entries.length) {
    return compact;
  }

  const lines = entries.map(([key, value]) => {
    const prop = formatProp(key, value, true);

    return prop
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
  });

  return `<${data.name}\n${lines.join("\n")}\n${closing.trimStart()}`;
};
const normalizeElementAttributes = (attrs: Record<string, unknown>): Record<string, unknown> => {
  const data = getElementData(attrs);

  if (typeof attrs.source === "string") {
    try {
      if (canonicalElementValue(parseElement(attrs.source)) === canonicalElementValue(data)) {
        return { ...attrs, ...data };
      }
    } catch {
      /* Regenerate stale or invalid source from authoritative attributes. */
    }
  }

  return { ...attrs, ...data, source: formatElement(data) };
};
const tokenizeElement = (source: string): ElementToken[] => {
  const tokens: ElementToken[] = [];
  let position = 0;
  let tagName = false;
  let depth = 0;

  while (position < source.length) {
    const from = position;
    const character = source[position++];
    let kind: ElementToken["kind"] = "punctuation";

    if (/\s/.test(character)) {
      continue;
    }

    if (character === '"') {
      kind = "string";
      while (position < source.length) {
        const next = source[position++];
        if (next === "\\") {
          position = Math.min(position + 1, source.length);
          continue;
        }
        if (next === '"') {
          break;
        }
      }
      if (depth && /^\s*:/.test(source.slice(position))) kind = "property";
    } else if (/^[$_\p{ID_Start}]/u.test(source.slice(from))) {
      const identifier =
        (tagName
          ? /^[A-Za-z][A-Za-z0-9_.-]*/
          : /^[$_\p{ID_Start}][$\u200c\u200d_\p{ID_Continue}-]*/u
        ).exec(source.slice(from))?.[0] || character;

      position = from + identifier.length;
      kind = tagName
        ? "name"
        : !depth
          ? "attribute"
          : /^\s*:/.test(source.slice(position))
            ? "property"
            : "literal";
      tagName = false;
    } else if (/[0-9-]/.test(character)) {
      while (/[0-9.eE+-]/.test(source[position] || "") && position < source.length) {
        position += 1;
      }
      kind = "number";
    } else if (character === "=") {
      kind = "operator";
    } else if (character === "<") {
      tagName = true;
    } else if (character === "{" || character === "[") {
      depth += 1;
    } else if (character === "}" || character === "]") {
      depth = Math.max(0, depth - 1);
    }

    tokens.push({ from, to: position, kind });
  }

  return tokens;
};
const getElementSearchText = (data: ElementData): string => {
  const lines = [data.name];
  const append = (key: string, value: ElementValue, depth: number) => {
    const prefix = `${"  ".repeat(depth)}- ${key}:`;
    const entries = value && typeof value === "object" ? Object.entries(value) : null;

    if (entries?.length) {
      lines.push(prefix);
      entries.forEach(([childKey, child]) => append(childKey, child, depth + 1));
    } else {
      const text =
        value === true
          ? "yes"
          : value === false
            ? "no"
            : typeof value === "string"
              ? value
              : JSON.stringify(value);
      lines.push(`${prefix} ${text}`);
    }
  };

  Object.entries(data.props).forEach(([key, value]) => append(key, value, 0));
  return lines.join("\n");
};
const findDisallowedElementBlock = (
  nodes: ElementContent[],
  allowed: readonly string[],
  nested = false
): string | null => {
  for (const node of nodes) {
    if (
      !ELEMENT_BLOCKS.includes(node.type) &&
      (!nested || !ELEMENT_STRUCTURE.includes(node.type))
    ) {
      return node.type;
    }
    if (
      ELEMENT_BLOCKS.includes(node.type) &&
      node.type !== "paragraph" &&
      !allowed.includes(node.type)
    ) {
      return node.type;
    }

    const invalid = findDisallowedElementBlock(node.content || [], allowed, true);

    if (invalid) {
      return invalid;
    }
  }

  return null;
};

export {
  ELEMENT_BLOCKS,
  parseElement,
  getElementTagName,
  getElementData,
  formatElement,
  normalizeElementAttributes,
  canonicalElementValue,
  tokenizeElement,
  getElementSearchText,
  findDisallowedElementBlock
};
export type { ElementData, ElementValue, ElementToken, ElementContent };
