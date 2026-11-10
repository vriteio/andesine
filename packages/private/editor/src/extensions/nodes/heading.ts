import {
  Heading as BaseHeading,
  type HeadingOptions as BaseHeadingOptions,
  type Level
} from "@andesine/document/tiptap";
import { nodePasteRule } from "#editor/lib";
import { type ExtendedRegExpMatchArray, textblockTypeInputRule } from "@tiptap/core";

interface HeadingOptions extends BaseHeadingOptions {
  enabledLevels: Level[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    heading: {
      setHeading: (attributes: { level: Level }) => ReturnType;
      toggleHeading: (attributes: { level: Level }) => ReturnType;
    };
  }
}

const Heading = BaseHeading.extend<HeadingOptions>({
  addOptions() {
    return { ...this.parent!(), enabledLevels: [1, 2, 3, 4, 5, 6] };
  },
  addCommands() {
    return {
      setHeading: (attributes) => {
        return ({ commands }) => {
          if (!this.options.enabledLevels.includes(attributes.level)) {
            return false;
          }

          return commands.setNode(this.name, attributes);
        };
      },
      toggleHeading: (attributes) => {
        return ({ commands }) => {
          if (!this.options.enabledLevels.includes(attributes.level)) {
            return false;
          }

          return commands.toggleNode(this.name, "paragraph", attributes);
        };
      }
    };
  },
  addKeyboardShortcuts() {
    return this.options.enabledLevels.reduce(
      (items, level) => ({
        ...items,
        ...{
          [`Mod-Alt-${level}`]: () => this.editor.commands.toggleHeading({ level })
        }
      }),
      {}
    );
  },
  addInputRules() {
    return this.options.enabledLevels.map((level) => {
      return textblockTypeInputRule({
        find: new RegExp(`^(#{${level}})\\s$`),
        type: this.type,
        getAttributes: {
          level
        }
      });
    });
  },
  addPasteRules() {
    return this.options.enabledLevels.map((level) => {
      return nodePasteRule({
        find: new RegExp(`^#{${level}}\\s(.*)`, "g"),
        type: this.type,
        getAttributes() {
          return {
            level
          };
        },
        getContent(match: ExtendedRegExpMatchArray) {
          return match[1];
        }
      });
    });
  }
});

export { Heading };
