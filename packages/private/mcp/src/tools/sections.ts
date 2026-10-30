interface ContentBlock {
  fragment?: string;
  id: string;
  mdx: string;
  type: string;
}
interface Heading {
  id: string;
  index: number;
  level: number;
  path: string[];
  text: string;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/s;
const PATH_SEPARATOR = " > ";

const normalizeHeading = (text: string) => {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~\\]/g, "")
    .trim()
    .toLowerCase();
};
const getHeadings = (blocks: ContentBlock[]): Heading[] => {
  const headings: Heading[] = [];
  const parents: Heading[] = [];

  blocks.forEach((block, index) => {
    const match = block.type === "heading" ? HEADING_PATTERN.exec(block.mdx) : null;

    if (!match) return;

    const level = match[1].length;
    const text = match[2].trim();

    while (parents.length > 0 && parents[parents.length - 1].level >= level) parents.pop();

    const heading = {
      id: block.id,
      index,
      level,
      path: [...parents.map((parent) => parent.text), text],
      text
    };

    parents.push(heading);
    headings.push(heading);
  });

  return headings;
};
const matchesSection = (heading: Heading, section: string) => {
  if (heading.id === section) return true;

  const target = normalizeHeading(section);

  // Any end of the path matches: the heading alone, or with its parents.
  return heading.path.some((_, index) => {
    return heading.path.slice(index).map(normalizeHeading).join(PATH_SEPARATOR) === target;
  });
};
/** The blocks of one section, without crossing into another fragment. */
const getSectionBlocks = (blocks: ContentBlock[], headings: Heading[], section: string) => {
  const matches = headings.filter((heading) => matchesSection(heading, section));
  const [target] = matches;

  if (!target) {
    throw new Error(`No section matches "${section}". Read the headings with format outline.`);
  }

  if (matches.length > 1) {
    const options = matches.map(({ id, path }) => `${path.join(PATH_SEPARATOR)} (${id})`);

    throw new Error(
      `Several sections match "${section}": ${options.join("; ")}. Use a heading's block ID.`
    );
  }

  const nextHeading = headings.find(({ index, level }) => {
    return index > target.index && level <= target.level;
  });
  const candidates = blocks.slice(target.index, nextHeading?.index);
  const fragmentEnd = candidates.findIndex(({ fragment }) => {
    return fragment !== blocks[target.index].fragment;
  });

  return candidates.slice(0, fragmentEnd === -1 ? undefined : fragmentEnd);
};
/** The blocks of the sections, in document order and without repeating overlaps. */
const getSections = (blocks: ContentBlock[], sections: string[]): ContentBlock[] => {
  const headings = getHeadings(blocks);
  const selected = new Set(
    sections.flatMap((section) => getSectionBlocks(blocks, headings, section))
  );

  return blocks.filter((block) => selected.has(block));
};

export { getHeadings, getSections };
