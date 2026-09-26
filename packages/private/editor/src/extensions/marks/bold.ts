import { Bold as BaseBold } from "@andesine/document/tiptap";
import { markInputRule, markPasteRule } from "@tiptap/core";

const Bold = BaseBold.extend({
  exitable: true,
  addInputRules() {
    return [
      markInputRule({
        find: /((?:\*\*)((?:.+))(?:\*\*))$/,
        type: this.type
      }),
      markInputRule({
        find: /((?:__)((?:.+))(?:__))$/,
        type: this.type
      })
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: /((?:\*\*)((?:.+))(?:\*\*))/g,
        type: this.type
      }),
      markPasteRule({
        find: /((?:__)((?:.+))(?:__))/g,
        type: this.type
      })
    ];
  }
});

export { Bold };
