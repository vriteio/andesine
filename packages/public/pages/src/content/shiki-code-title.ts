import { getCodeTitle } from "./mdx-components";

interface TransformerContext {
  /** Sätteri passes the fence meta as a string; other processors pass `{ __raw }`. */
  options: { meta?: string | { __raw?: string } };
}

interface HastElement {
  properties: Record<string, unknown>;
}

/** Adds `data-title` from a code fence `title="..."` to the highlighted `<pre>`. */
const shikiCodeTitle = {
  name: "andesine-code-title",
  pre(this: TransformerContext, node: HastElement): void {
    const meta = this.options.meta;
    const title = getCodeTitle(typeof meta === "string" ? meta : meta?.__raw);

    if (title) node.properties["data-title"] = title;
  }
};

export { shikiCodeTitle };
