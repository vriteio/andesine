import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { webhookValidatorPlugin, WEBHOOK_VALIDATOR_MODULE } from "./scripts/webhook-validator";

export default defineConfig({
  cwd: import.meta.dirname,
  input: {
    "index": "src/index.ts",
    "streaming": "src/streaming.ts",
    "content-slug": "src/content-slug.ts",
    "webhooks": "src/webhooks.ts",
    "extensions": "src/extensions.ts"
  },
  plugins: [webhookValidatorPlugin(import.meta.dirname), dts({ cwd: import.meta.dirname })],
  platform: "neutral",
  tsconfig: "tsconfig.json",
  preserveEntrySignatures: "strict",
  external: (id) => {
    return (
      id !== WEBHOOK_VALIDATOR_MODULE &&
      !id.startsWith("ajv/") &&
      !id.startsWith("ajv-formats/") &&
      !id.startsWith(".") &&
      !path.isAbsolute(id)
    );
  },
  output: {
    dir: "dist",
    cleanDir: true,
    format: "esm",
    entryFileNames: "[name].js",
    sourcemap: true
  }
});
