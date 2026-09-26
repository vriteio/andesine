import { mergeAttributes, Node } from "@tiptap/core";
import { convert as convertToSlug } from "url-slug";

interface HeadingOptions {
  levels: Level[];
  HTMLAttributes: Record<string, unknown>;
}
type Level = 1 | 2 | 3 | 4 | 5 | 6;

const Heading = Node.create<HeadingOptions>({
  name: "heading",
  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6],
      HTMLAttributes: {}
    };
  },
  content: "text*",
  group: "block",
  defining: true,
  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false
      }
    };
  },
  parseHTML() {
    return this.options.levels.map((level: Level) => ({
      tag: `h${level}`,
      attrs: { level }
    }));
  },
  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel ? node.attrs.level : this.options.levels[0];

    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-slug": convertToSlug(node.textContent),
        "class": "relative group"
      }),
      0
    ];
  }
});

export { Heading };

export type { HeadingOptions, Level };
