import { Highlight as BaseHighlight } from "@andesine/document/tiptap";
import { markInputRule, markPasteRule } from "@tiptap/core";

const Highlight = BaseHighlight.extend({
  exitable: true,
  addInputRules() {
    return [
      markInputRule({
        find: /((?:==)((?:[^~=]+))(?:==))$/,
        type: this.type
      })
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: /((?:==)((?:[^~=]+))(?:==))/g,
        type: this.type
      })
    ];
  }
});

export { Highlight };
