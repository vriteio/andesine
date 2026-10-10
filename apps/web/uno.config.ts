import {
  presetTypography,
  presetWind3,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup
} from "unocss";
import { defineConfig } from "unocss/vite";
import { andesineIcons, presetAndesine } from "@andesine/uno-preset";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformerCompileClass } from "unocss";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = defineConfig({
  content: {
    filesystem: [
      `${projectRoot}/src/**/*.{ts,tsx,html}`,
      `${workspaceRoot}/packages/private/components/src/**/*.{ts,tsx,html}`,
      `${workspaceRoot}/packages/private/editor/src/**/*.{ts,tsx,html}`
    ]
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
    transformerCompileClass({
      classPrefix: "uno-b1-",
      layer: "b1",
      trigger: ":base:"
    }),
    {
      ...transformerCompileClass({
        classPrefix: "uno-b2-",
        layer: "b2",
        trigger: ":base-2:"
      }),
      name: "@unocss/transformer-compile-class-2"
    },
    transformerVariantGroup()
  ],
  presets: [
    presetIcons({ collections: { andesine: andesineIcons } }),
    presetWind3(),
    presetTypography(),
    presetAndesine()
  ]
});

export default config;
