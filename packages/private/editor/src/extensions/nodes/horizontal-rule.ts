import { HorizontalRule as BaseHorizontalRule } from "@andesine/document/tiptap";
import { nodeInputRule, nodePasteRule } from "#editor/lib";

const HorizontalRule = BaseHorizontalRule.extend({
  addInputRules() {
    return [
      nodeInputRule({
        find: /^(?:---|—-|___\s|\*\*\*\s)$/,
        type: this.type
      })
    ];
  },
  addPasteRules() {
    return [
      nodePasteRule({
        find: /^(?:---|—-|___|\*\*\*)\s*$/g,
        type: this.type
      })
    ];
  }
});

export { HorizontalRule };
