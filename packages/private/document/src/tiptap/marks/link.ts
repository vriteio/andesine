import { Link as BaseLink } from "@tiptap/extension-link";
import { validateURL } from "../validate-url";

const Link = BaseLink.extend({
  inclusive: true,
  priority: 100,
  addOptions() {
    const parentOptions = this.parent!();

    return {
      ...parentOptions,
      protocols: [],
      defaultProtocol: "http",
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
        class: null
      },
      isAllowedUri: (url) => Boolean(validateURL(url))
    };
  },
  parseHTML() {
    return [
      {
        tag: "a[href]",
        getAttrs: (element) => {
          return validateURL((element as HTMLElement).getAttribute("href") || "") ? null : false;
        }
      }
    ];
  }
});

export { Link };
