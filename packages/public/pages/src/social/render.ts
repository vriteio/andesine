import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { html } from "satori-html";
import { socialImageSize } from "./size";
import type { SocialCard, SocialCardData, SocialCardFont } from "./types";

interface MarkupNode {
  type: string;
  props: { children?: string | MarkupNode | Array<string | MarkupNode>; [name: string]: unknown };
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** satori-html keeps entities as text, so card markup could not show `<` or `&`. */
const decodeEntities = (text: string): string => {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name: string) => {
    if (name[0] !== "#") return entities[name] ?? entity;

    const isHex = name[1]?.toLowerCase() === "x";

    return String.fromCodePoint(Number.parseInt(name.slice(isHex ? 2 : 1), isHex ? 16 : 10));
  });
};
/**
 * Prepares satori-html output for Satori: decodes entities in text and attributes, and removes
 * empty `children` arrays, which Satori counts as many children.
 */
const prepareTree = (node: MarkupNode): MarkupNode => {
  const props = Object.fromEntries(
    Object.entries(node.props).map(([name, value]) => {
      return [
        name,
        typeof value === "string" && name !== "children" ? decodeEntities(value) : value
      ];
    })
  );
  const { children } = node.props;
  const prepare = (child: string | MarkupNode): string | MarkupNode => {
    return typeof child === "string" ? decodeEntities(child) : prepareTree(child);
  };

  if (Array.isArray(children)) {
    return {
      ...node,
      props: { ...props, children: children.length ? children.map(prepare) : undefined }
    };
  }

  return {
    ...node,
    props: children === undefined ? props : { ...props, children: prepare(children) }
  };
};
/** Decodes a base64 data URL. `atob` works in every runtime, unlike `Buffer`. */
const fromDataURL = (url: string): ArrayBuffer => {
  const text = atob(url.slice(url.indexOf(",") + 1));

  return Uint8Array.from(text, (character) => character.charCodeAt(0)).buffer;
};
const toFontData = (font: SocialCardFont) => {
  return { ...font, data: typeof font.data === "string" ? fromDataURL(font.data) : font.data };
};
const renderSocialImage = async (
  card: SocialCard,
  data: SocialCardData
): Promise<Uint8Array<ArrayBuffer>> => {
  // Whitespace between tags would become text nodes, which Satori lays out as children.
  const markup = String(card.render(data)).trim().replace(/>\s+</g, "><");
  const tree = prepareTree(html(markup) as MarkupNode);
  const svg = await satori(tree as Parameters<typeof satori>[0], {
    ...socialImageSize,
    fonts: (await card.fonts()).map(toFontData)
  });

  const png = new Resvg(svg, { fitTo: { mode: "width", value: socialImageSize.width } })
    .render()
    .asPng();

  return new Uint8Array(png);
};

export { renderSocialImage };
