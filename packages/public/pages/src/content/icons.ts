import { getIconCSS, getIconData } from "@iconify/utils";

/**
 * Creates CSS for icon classes, such as `i-lucide:book`, that come from content data. UnoCSS
 * cannot see these classes in the source. The selectors have no specificity, so size classes
 * on the same element still apply.
 */
const createIconCSS = async (icons: Iterable<string>): Promise<string> => {
  // Loaded on use: the package reads icon sets from disk, which Cloudflare Workers do not have.
  const { lookupCollection } = await import("@iconify/json");
  const rules = await Promise.all(
    [...new Set(icons)].map(async (icon) => {
      const [, prefix, name] = /^i-([\w-]+):([\w-]+)$/.exec(icon) ?? [];
      const collection = prefix ? await lookupCollection(prefix).catch(() => undefined) : undefined;
      const data = collection && name ? getIconData(collection, name) : undefined;

      if (!data) throw new Error(`Unknown icon ${icon}. Use an Iconify class, e.g. i-lucide:book.`);

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
