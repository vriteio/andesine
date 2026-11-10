import { getLinkedEntryID } from "@andesine/components";
import { Link as BaseLink, validateURL } from "@andesine/document/tiptap";
import { markInputRule, markPasteRule, mergeAttributes } from "@tiptap/core";

const Link = BaseLink.extend({
  exitable: true,
  addOptions() {
    const parentOptions = this.parent!();

    return {
      ...parentOptions,
      linkOnPaste: true,
      autolink: true,
      enableClickSelection: false,
      markdownLinks: parentOptions.markdownLinks ?? false,
      openOnClick: false,
      validate: (url) => Boolean(validateURL(url)),
      shouldAutoLink: (url) => Boolean(validateURL(url))
    };
  },
  // Entry links open in the app, so they don't open a new tab.
  renderHTML(props) {
    const isEntryLink = Boolean(getLinkedEntryID(String(props.HTMLAttributes.href ?? "")));
    const attributes = {
      ...props.HTMLAttributes,
      "target": null,
      "rel": null,
      "data-internal": ""
    };

    if (!isEntryLink) return this.parent!(props);

    return ["a", mergeAttributes(this.options.HTMLAttributes, attributes), 0];
  },
  addInputRules() {
    return [
      markInputRule({
        find: /\[(.+?)]\(.+?\)$/,
        type: this.type.schema.marks.link,
        getAttributes({ input = "" }: RegExpMatchArray) {
          const [wrappedUrl] = input.match(/\(.+?\)/) || [];
          const href = validateURL(wrappedUrl ? wrappedUrl.slice(1, -1) : "");

          return href ? { href } : null;
        }
      })
    ];
  },
  addPasteRules() {
    return [
      ...(this.parent?.() || []),
      markPasteRule({
        find: /\[(.+?)]\(.+?\)/g,
        type: this.type.schema.marks.link,
        getAttributes({ input = "" }: RegExpMatchArray) {
          const [wrappedUrl] = input.match(/\(.+?\)/) || [];
          const href = validateURL(wrappedUrl ? wrappedUrl.slice(1, -1) : "");

          return href ? { href } : null;
        }
      })
    ];
  }
});

export { Link };
