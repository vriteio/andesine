import { type IconPickerIcons, type IconPickerSet, parseIcon } from "@andesine/components";

interface IconData {
  body: string;
  width?: number;
  height?: number;
}
interface IconSet {
  icons: Record<string, IconData>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
}

/** Iconify sets for icons that views get from documents, e.g. a card's icon; loaded on use. */
const ICON_SETS: Record<string, () => Promise<{ default: IconSet }>> = {
  "lucide": () => import("@iconify/json/json/lucide.json"),
  "tabler": () => import("@iconify/json/json/tabler.json"),
  "simple-icons": () => import("@iconify/json/json/simple-icons.json")
};
/** The sets of icon pickers, e.g. an element's icon prop, in their order. */
const ICON_PICKER_SETS: IconPickerSet[] = [
  { prefix: "lucide", label: "Lucide" },
  { prefix: "tabler", label: "Tabler" },
  { prefix: "simple-icons", label: "Brands" }
];

const sets = new Map<string, Promise<IconPickerIcons | null>>();

const toMask = (set: IconSet, name: string): string | null => {
  const icon = set.icons[name] ?? set.icons[set.aliases?.[name]?.parent ?? ""];

  if (!icon) return null;

  const width = icon.width ?? set.width ?? 16;
  const height = icon.height ?? set.height ?? 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;

  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};
/** A bundled set's icons and their masks, e.g. for an icon picker; null for other sets. */
const loadIconSet = (prefix: string): Promise<IconPickerIcons | null> => {
  const loadSet = ICON_SETS[prefix];

  if (!loadSet) return Promise.resolve(null);

  const icons =
    sets.get(prefix) ??
    loadSet().then(
      ({ default: set }) => {
        const masks = new Map<string, string | null>();

        return {
          names: Object.keys(set.icons),
          getMask: (name: string) => {
            if (!masks.has(name)) masks.set(name, toMask(set, name));

            return masks.get(name) ?? null;
          }
        };
      },
      () => null
    );

  sets.set(prefix, icons);

  return icons;
};
/**
 * The CSS mask of an Iconify class, e.g. `i-lucide:settings`, from the bundled sets; null for
 * other icons, e.g. an extension's own, which its CSS provides.
 */
const loadIconMask = async (className: string): Promise<string | null> => {
  const { prefix, name } = parseIcon(className);
  const icons = await loadIconSet(prefix);

  return icons?.getMask(name) ?? null;
};

export { ICON_PICKER_SETS, loadIconMask, loadIconSet };
