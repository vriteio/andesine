import type { ResolvedConfig } from "../config/resolve";
import { typesConfigSchema, type TypesConfig } from "../config/schema";
import { CLIError, exitCodes } from "../errors";
import path from "node:path";

interface TypeOptions {
  source?: "published" | "current";
  channel?: string;
  snapshot?: string;
  collection?: string[];
  allCollections?: boolean;
  output?: string;
  includeEntryIds?: boolean;
  includeEntryPaths?: boolean;
  includeTree?: boolean;
}
interface GenerateOptions extends TypeOptions {
  check?: boolean;
  watch?: boolean;
  force?: boolean;
  interval?: string;
}

const validateTypeOptions = (options: TypeOptions): void => {
  const invalidSource =
    (options.channel !== undefined && options.snapshot !== undefined) ||
    (options.source === "current" &&
      (options.channel !== undefined || options.snapshot !== undefined));

  if (invalidSource) {
    throw new CLIError(
      "Use --channel or --snapshot for published content; neither can be used with --source current.",
      exitCodes.usage
    );
  }

  if (options.allCollections && options.collection) {
    throw new CLIError("Use --collection or --all-collections, not both.", exitCodes.usage);
  }
};

/** Apply command overrides without changing the saved configuration. */
const resolveTypes = (config: ResolvedConfig, options: TypeOptions): TypesConfig => {
  const initial = config.types;
  const directory = config.configPath ? path.dirname(config.configPath) : process.cwd();
  let source = initial.source;

  validateTypeOptions(options);

  if (options.source === "current") {
    source = { kind: "current" };
  } else if (options.snapshot !== undefined) {
    source = { kind: "published", snapshotID: options.snapshot };
  } else if (options.source === "published" || options.channel !== undefined) {
    const previousChannel =
      initial.source.kind === "published" && "channel" in initial.source
        ? initial.source.channel
        : "published";

    source = { kind: "published", channel: options.channel ?? previousChannel };
  }

  const parsed = typesConfigSchema.safeParse({
    ...initial,
    source,
    collections: options.allCollections ? [] : (options.collection ?? initial.collections),
    output: options.output ?? initial.output,
    includeEntryIDs: options.includeEntryIds ?? initial.includeEntryIDs,
    includeEntryPaths: options.includeEntryPaths ?? initial.includeEntryPaths,
    includeTree: options.includeTree ?? initial.includeTree
  });

  if (!parsed.success) {
    throw new CLIError(
      "Invalid type options. Check the source, collection selectors, and output path.",
      exitCodes.usage
    );
  }

  const output = path.resolve(directory, parsed.data.output);

  if (!/\.(?:ts|mts|cts)$/.test(output) || output === config.configPath) {
    throw new CLIError(
      "The types output must be a TypeScript file, separate from the configuration.",
      exitCodes.usage
    );
  }

  return { ...parsed.data, collections: [...new Set(parsed.data.collections)], output };
};

export { resolveTypes, validateTypeOptions };
export type { TypeOptions, GenerateOptions };
