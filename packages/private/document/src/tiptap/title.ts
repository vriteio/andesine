import { mergeAttributes, Node } from "@tiptap/core";

const Title = Node.create({
  name: "title",
  content: "text*",
  marks: "",
  priority: 1000,
  parseHTML() {
    return [{ tag: "header[data-type='title']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      `header`,
      mergeAttributes(HTMLAttributes, {
        "class": "not-prose",
        "data-type": "title"
      }),
      ["h1", {}, 0]
    ];
  }
});

export { Title };
