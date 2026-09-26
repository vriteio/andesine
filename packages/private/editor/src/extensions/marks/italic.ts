import { Italic as BaseItalic } from "@andesine/document/tiptap";
import { markInputRule, markPasteRule } from "@tiptap/core";

const Italic = BaseItalic.extend({
  exitable: true,
  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)((?:\*)((?:[^*]+))(?:\*))$/,
        type: this.type
      }),
      markInputRule({
        find: /((?:_)((?:[^_]+))(?:_))$/,
        type: this.type
      }),
      markInputRule({
        find: /(?:^|\s)((?:_)((?:[^_]+))(?:_))$/,
        type: this.type
      })
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: /((?:\*)((?:[^*]+))(?:\*))/g,
        type: this.type
      }),
      markPasteRule({
        find: /((?:_)((?:[^_]+))(?:_))/g,
        type: this.type
      })
    ];
  }
});

export { Italic };
