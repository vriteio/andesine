import { CLIError, exitCodes } from "../errors";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type * as z from "zod";

/** Read declarative JSON only. Missing optional files are distinct from invalid files. */
const readConfigFile = async <Schema extends z.ZodType>(
  filePath: string,
  schema: Schema,
  optional = false
): Promise<z.output<Schema> | undefined> => {
  let content: string;
  let value: unknown;

  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (optional && code === "ENOENT") return undefined;

    throw new CLIError(`Cannot read ${filePath} (${code ?? "filesystem error"}).`, exitCodes.usage);
  }

  try {
    value = JSON.parse(content);
  } catch {
    throw new CLIError(`Invalid JSON in ${filePath}.`, exitCodes.usage);
  }

  const result = schema.safeParse(value);

  if (!result.success) {
    // Report field locations without echoing values that could contain a pasted secret.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "root"))];

    throw new CLIError(
      `Invalid configuration in ${filePath}. Check: ${fields.join(", ")}.`,
      exitCodes.usage
    );
  }

  return result.data;
};

/** Find the nearest andesine.json. Only init can select a missing explicit file. */
const findProjectConfig = async <Schema extends z.ZodType>(
  cwd: string,
  schema: Schema,
  explicitPath?: string,
  allowMissingExplicit = false
): Promise<{ path: string; value: z.output<Schema> } | undefined> => {
  let directory = path.resolve(cwd);

  if (explicitPath !== undefined) {
    const filePath = path.resolve(directory, explicitPath);
    const value = await readConfigFile(filePath, schema, allowMissingExplicit);

    return value === undefined ? undefined : { path: filePath, value };
  }

  while (true) {
    const filePath = path.join(directory, "andesine.json");
    const value = await readConfigFile(filePath, schema, true);
    const parent = path.dirname(directory);

    if (value !== undefined) return { path: filePath, value };
    if (parent === directory) return undefined;

    directory = parent;
  }
};

export { readConfigFile, findProjectConfig };
