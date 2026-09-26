import { mergeAttributes } from "@tiptap/core";
import { HorizontalRule as BaseHorizontalRule } from "@tiptap/extension-horizontal-rule";

const HorizontalRule = BaseHorizontalRule.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "horizontal-rule"
      }),
      ["hr"]
    ];
  }
});

export { HorizontalRule };
