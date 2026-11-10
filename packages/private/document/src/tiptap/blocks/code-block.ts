import { CodeBlock as BaseCodeBlock } from "@tiptap/extension-code-block";

/** A code block with an optional title, e.g. a file name or a tab label in a code group. */
const CodeBlock = BaseCodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) => (attributes.title ? { "data-title": attributes.title } : {})
      }
    };
  }
});

export { CodeBlock };
