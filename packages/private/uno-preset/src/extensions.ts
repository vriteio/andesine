import {
  ExtensionStyleError,
  getExtensionScope,
  getViewScopePrelude,
  validateExtensionCSS
} from "@andesine/contracts/extensions/styles";
import { createGenerator, presetIcons, presetWind3, type UnoGenerator } from "unocss";
import { presetAndesine } from "./index";

interface ExtensionCSSOptions {
  /** The extension name; every rule is scoped to it. */
  name: string;
  /** Iconify collections by set prefix: default, installed, and custom sets. */
  icons: IconCollections;
}
interface ExtensionViewCSSOptions extends ExtensionCSSOptions {
  /** The bundled frontend code that utility and icon classes are read from. */
  code: string;
}
interface ExtensionIconCSSOptions extends ExtensionCSSOptions {
  /** Icon classes of the manifest (`icon`, panel and block action icons). */
  classes: string[];
}

type IconCollections = NonNullable<NonNullable<Parameters<typeof presetIcons>[0]>["collections"]>;

/** Icon sets that the extension build provides without installation. */
const DEFAULT_ICON_SETS = ["lucide", "tabler"];

const createExtensionGenerator = (icons: IconCollections): Promise<UnoGenerator> => {
  return createGenerator({
    presets: [
      presetWind3({ preflight: false }),
      // Host components size icons; scoped icon rules would otherwise override their classes.
      presetIcons({
        collections: icons,
        processor: (css) => {
          delete css.width;
          delete css.height;
        }
      }),
      presetAndesine()
    ],
    // Animations need global keyframes, which extension CSS cannot define.
    blocklist: [/^animate-/]
  });
};
/**
 * Generates view CSS in one `@scope` rule from the views down to their content slots, without
 * preflights (the host has them). Throws if invalid, e.g. when an arbitrary value loads a URL.
 */
const generateExtensionCSS = async (options: ExtensionViewCSSOptions): Promise<string> => {
  const generator = await createExtensionGenerator(options.icons);
  const { css: rules } = await generator.generate(options.code, {
    preflights: false,
    scope: ":scope"
  });
  const css = rules.trim() ? `@scope ${getViewScopePrelude(options.name)} {\n${rules}\n}\n` : "";

  validateExtensionCSS(css, options.name);

  return css;
};
/** Generates the CSS of the manifest icons, which the host shows outside the views. */
const generateExtensionIconCSS = async (options: ExtensionIconCSSOptions): Promise<string> => {
  const generator = await createExtensionGenerator(options.icons);
  const { css, matched } = await generator.generate(options.classes.join(" "), {
    preflights: false,
    scope: getExtensionScope(options.name, "icon")
  });
  const missing = options.classes.filter((icon) => !matched.has(icon));

  if (missing.length) throw new ExtensionStyleError(`Unknown icons: ${missing.join(", ")}`);

  validateExtensionCSS(css, options.name, "icon");

  return css;
};

export { DEFAULT_ICON_SETS, generateExtensionCSS, generateExtensionIconCSS };
export type { ExtensionViewCSSOptions, ExtensionIconCSSOptions };
