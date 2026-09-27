import { z } from "zod";
import {
  configSchema,
  type AndesineSourceConfig,
  type PagesConfig,
  type PagesConfigInput,
  type SourceConfig
} from "./schema";

const parseConfig = (input: unknown, source = "Andesine Pages config"): PagesConfig => {
  const result = configSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Invalid ${source}:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
};
const defineConfig = (input: PagesConfigInput): PagesConfig => parseConfig(input);
/** Sources that render on each request, and need a server. */
const isLiveSource = (source: SourceConfig): source is AndesineSourceConfig => {
  return source.type === "andesine" && source.rendering === "ssr";
};

export { defineConfig, parseConfig, isLiveSource };
export type * from "./schema";
