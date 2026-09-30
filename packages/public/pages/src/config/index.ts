import { z } from "zod";
import { configSchema, type PagesConfig, type PagesConfigInput } from "./schema";

const parseConfig = (input: unknown, source = "Andesine Pages config"): PagesConfig => {
  const result = configSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Invalid ${source}:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
};
const defineConfig = (input: PagesConfigInput): PagesConfig => parseConfig(input);

export { defineConfig, parseConfig };
export type * from "./schema";
