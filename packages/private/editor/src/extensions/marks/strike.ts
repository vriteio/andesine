import { Strike as BaseStrike } from "@andesine/document/tiptap";
import { markInputRule, markPasteRule } from "@tiptap/core";

const Strike = BaseStrike.extend({
  exitable: true,
  addInputRules() {
    return [
      markInputRule({
        find: /((?:~~)((?:[^~]+))(?:~~))$/,
        type: this.type
      })
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: /((?:~~)((?:[^~]+))(?:~~))/g,
        type: this.type
      })
    ];
  }
});

export { Strike };
