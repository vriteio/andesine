import { Bold as BaseBold } from "@tiptap/extension-bold";

const Bold = BaseBold.extend({
  priority: 200,
  parseHTML() {
    return [
      {
        tag: "strong"
      },
      {
        tag: "b",
        getAttrs: (node) => (node as HTMLElement).style.fontWeight !== "normal" && null
      },
      {
        style: "font-weight",
        getAttrs: (value) => {
          const matchBold = /^(bold(er)?|[7-9]\d{2,})$/;

          return matchBold.test(value as string) && null;
        }
      }
    ];
  }
});

export { Bold };
