interface Tag {
  start: number;
  end: number;
  /** The audience of an opening tag; undefined for a closing tag. */
  audience?: Audience;
}

type Audience = "agents" | "humans";

const tagPattern = /<Visibility\s+for=(["'])(agents|humans)\1\s*>|<\/Visibility\s*>/g;

/** Ranges of fenced and inline code, where tags are only text. */
const findCode = (source: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = [];

  let fence: { marker: string; start: number } | undefined;
  let offset = 0;

  for (const line of source.split("\n")) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    const end = offset + line.length;

    if (fence) {
      const closesFence = marker?.[0] === fence.marker[0] && marker.length >= fence.marker.length;

      if (closesFence) {
        ranges.push([fence.start, end]);
        fence = undefined;
      }
    } else if (marker) {
      fence = { marker, start: offset };
    } else {
      for (const match of line.matchAll(/`+[^`]*`+/g)) {
        ranges.push([offset + match.index, offset + match.index + match[0].length]);
      }
    }

    offset = end + 1;
  }

  if (fence) ranges.push([fence.start, source.length]);

  return ranges;
};
/** Removes the indent that all lines share, as JSX children are often indented. */
const dedent = (text: string): string => {
  const lines = text.split("\n");
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => /^[ \t]*/.exec(line)![0].length);
  const indent = Math.min(...indents);

  return indents.length ? lines.map((line) => line.slice(indent)).join("\n") : text;
};
/**
 * Keeps the `<Visibility>` blocks of one audience, without their tags, and removes the others.
 * Tags in code stay. Blocks cannot be nested.
 */
const filterVisibility = (source: string, audience: Audience): string => {
  const code = findCode(source);
  const tags: Tag[] = [...source.matchAll(tagPattern)]
    .map((match) => {
      return {
        start: match.index,
        end: match.index + match[0].length,
        audience: match[2] as Audience | undefined
      };
    })
    .filter((tag) => !code.some(([start, end]) => tag.start >= start && tag.end <= end));

  let result = "";
  let position = 0;

  for (let index = 0; index < tags.length; index++) {
    const open = tags[index]!;
    const close = tags[index + 1];
    const isBlock = open.audience !== undefined && close !== undefined && !close.audience;

    if (!isBlock) {
      throw new Error("Each <Visibility> needs a closing tag, and blocks cannot be nested.");
    }

    result += source.slice(position, open.start);
    result += open.audience === audience ? dedent(source.slice(open.end, close.start)) : "";
    position = close.end;
    index++;
  }

  return `${result}${source.slice(position)}`.replace(/\n{3,}/g, "\n\n");
};

export { filterVisibility };
export type { Audience };
