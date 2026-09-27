import {
  defineConfig,
  presetIcons,
  presetTypography,
  presetWind3,
  transformerCompileClass,
  transformerDirectives,
  transformerVariantGroup
} from "unocss";
import { colors } from "unocss/preset-wind3";
import config from "./andesine.config";
import { logoSVG } from "./src/assets/andesine";

const { gray } = colors;
const brandGradient = `linear-gradient(to top right, ${config.brand.secondary}, ${config.brand.primary}, ${config.brand.secondary})`;
// Page content styles, after the Andesine editor.
const prose = {
  // Compact spacing, like the Andesine editor: blocks and headings are 0.5rem apart.
  "h1,h2,h3,h4,h5,h6": { "margin": "0.5rem 0", "font-weight": "600", "color": gray[900] },
  "p,ul,ol,blockquote,pre,table,figure,img,video": { margin: "0.5rem 0" },
  "ul p,ol p": { margin: "0" },
  "a": {
    "font-weight": "500",
    "text-decoration-color": `${config.brand.tertiary}66`,
    "text-underline-offset": "2px",
    "transition": "text-decoration-color 200ms ease-out"
  },
  "a:hover": { "text-decoration-color": config.brand.tertiary },
  // A color change alone is hard to see, so keyboard focus also gets an outline.
  "a:focus-visible": {
    "text-decoration-color": config.brand.tertiary,
    "outline": `2px solid ${config.brand.tertiary}`,
    "outline-offset": "2px",
    "border-radius": "0.25rem"
  },
  ":not(pre)>code": {
    "position": "relative",
    "z-index": "0",
    "padding": "0.125rem 0.25rem",
    "font-weight": "500",
    "white-space": "pre-wrap",
    "color": "transparent",
    "background-image": brandGradient,
    "background-clip": "text"
  },
  ":not(pre)>code::before": {
    "content": '""',
    "position": "absolute",
    "inset": "0",
    "z-index": "-1",
    "border-radius": "0.375rem",
    "background-color": `${gray[950]}0a`,
    "pointer-events": "none"
  },
  ":not(pre)>code::after": { content: "none" },
  "pre": {
    "border": `1px solid ${gray[200]}`,
    "border-radius": "0.75rem",
    "background-color": "white !important"
  },
  "blockquote": {
    "border-left": `3px solid ${gray[300]}`,
    "padding-left": "1.375rem",
    "font-style": "normal",
    "color": gray[500]
  },
  "blockquote p:first-of-type::before": { content: "none" },
  "blockquote p:last-of-type::after": { content: "none" },
  "table": {
    "display": "table",
    "width": "100%",
    "border-collapse": "separate",
    "border-spacing": "0",
    "overflow": "hidden",
    "border": `1px solid ${gray[300]}`,
    "border-radius": "0.5rem"
  },
  "th,td": { "padding": "0.5rem", "vertical-align": "top", "text-align": "left" },
  "th": { "background-color": `${gray[100]}cc`, "font-weight": "600", "color": gray[700] },
  "tr+tr>td,tbody tr:first-child>td": { "border-top": `1px solid ${gray[300]}` },
  "td+td,th+th": { "border-left": `1px solid ${gray[300]}` },
  "img": { "border-radius": "0.5rem" },
  "hr": { "margin": "1.25rem 0", "border-color": gray[200] }
};

export default defineConfig({
  content: {
    // Scan the sources too: Astro and Solid escape `&`, `>`, and `'` in compiled class strings.
    filesystem: ["src/**/*.{astro,tsx}"],
    // Extract icon names used in the config.
    inline: [JSON.stringify(config)]
  },
  layers: {
    icons: -4,
    b1: -3,
    b2: -2,
    components: -1,
    default: 1,
    utilities: 2
  },
  transformers: [
    transformerDirectives(),
    // Component defaults: `:base:` and `:base-2:` classes go to low layers, so `class` props win.
    transformerCompileClass({ classPrefix: "uno-b1-", layer: "b1", trigger: ":base:" }),
    {
      ...transformerCompileClass({ classPrefix: "uno-b2-", layer: "b2", trigger: ":base-2:" }),
      name: "@unocss/transformer-compile-class-2"
    },
    transformerVariantGroup()
  ],
  presets: [
    presetIcons({ collections: { andesine: { logo: logoSVG } } }),
    presetWind3(),
    presetTypography({ cssExtend: prose })
  ],
  theme: {
    colors: {
      primary: config.brand.primary,
      secondary: config.brand.secondary,
      tertiary: config.brand.tertiary
    },
    animation: {
      keyframes: {
        "popover-in": "{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}",
        "popover-out": "{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.95)}}",
        "overlay-in":
          "{from{opacity:0;backdrop-filter:blur(0)}to{opacity:1;backdrop-filter:blur(4px)}}",
        "overlay-out":
          "{from{opacity:1;backdrop-filter:blur(4px)}to{opacity:0;backdrop-filter:blur(0)}}",
        "dialog-in":
          "{from{opacity:0;transform:translateY(2rem)}to{opacity:1;transform:translateY(0)}}",
        "dialog-out":
          "{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(2rem)}}"
      },
      durations: {
        "popover-in": "150ms",
        "popover-out": "150ms",
        "overlay-in": "300ms",
        "overlay-out": "300ms",
        "dialog-in": "300ms",
        "dialog-out": "300ms"
      },
      timingFns: {
        "popover-in": "ease-out",
        "popover-out": "ease-in",
        "overlay-in": "ease-out",
        "overlay-out": "ease-in",
        "dialog-in": "ease-out",
        "dialog-out": "ease-in"
      },
      counts: {
        "popover-in": "1 both",
        "popover-out": "1 both",
        "overlay-in": "1 both",
        "overlay-out": "1 both",
        "dialog-in": "1 both",
        "dialog-out": "1 both"
      }
    },
    fontFamily: {
      sans: `"Nunito Variable", ui-sans-serif, sans-serif`,
      mono: `"JetBrains Mono Variable", ui-monospace, monospace`
    }
  }
});
