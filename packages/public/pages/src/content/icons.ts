import type { IconifyJSON } from "@iconify-json/lucide";
import { getIconCSS, getIconData } from "@iconify/utils";

// The sets of `ICON_SETS` in the config schema. Loaded on use: the packages read their sets from
// disk, which Cloudflare Workers do not have.
const ICON_COLLECTIONS: Record<string, () => Promise<IconifyJSON>> = {
  "lucide": () => import("@iconify-json/lucide").then(({ icons }) => icons),
  "tabler": () => import("@iconify-json/tabler").then(({ icons }) => icons),
  "simple-icons": () => import("@iconify-json/simple-icons").then(({ icons }) => icons)
};

/**
 * Creates CSS for icon classes, such as `i-lucide:book`, that come from content data. UnoCSS
 * cannot see these classes in the source. The selectors have no specificity, so size classes
 * on the same element still apply.
 */
const createIconCSS = async (icons: Iterable<string>): Promise<string> => {
  const rules = await Promise.all(
    [...new Set(icons)].map(async (icon) => {
      const [, prefix = "", name] = /^i-([\w-]+):([\w-]+)$/.exec(icon) ?? [];
      const collection = await ICON_COLLECTIONS[prefix]?.();
      const data = collection && name ? getIconData(collection, name) : undefined;

      if (!data) {
        throw new Error(
          `Unknown icon ${icon}. Use a Lucide, Tabler, or Simple Icons class, e.g. i-lucide:book.`
        );
      }

      return getIconCSS(data, {
        iconSelector: `:where(.${icon.replace(/[^\w-]/g, (character) => `\\${character}`)})`,
        mode: "mask",
        format: "compressed"
      });
    })
  );

  return rules.join("");
};

export { createIconCSS };
