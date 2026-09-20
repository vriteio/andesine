import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format, resolveConfig } from "prettier";
import { createAPIContract } from "../src/contracts";
import { generateOpenAPI } from "../src/contracts/openapi";

const output = path.resolve(import.meta.dirname, "../../../packages/public/sdk/openapi.json");
const document = await generateOpenAPI(createAPIContract(), "https://api.andesine.app");

await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  await format(JSON.stringify(document), { ...(await resolveConfig(output)), parser: "json" })
);

console.log(`Exported ${Object.keys(document.paths || {}).length} API paths.`);
