import { type Command, Option } from "@commander-js/extra-typings";
import { createCommandContext } from "../context";
import { executeTypes } from "./execute";
import type { GlobalOptions } from "../config/resolve";
import type { GenerateOptions } from "./options";

const registerTypes = (program: Command, signal: AbortSignal): void => {
  const types = program
    .command("types")
    .description("Generate TypeScript types for workspace content");

  types
    .command("generate")
    .description("Generate a types file, check it for CI, or watch for metadata changes")
    .addOption(
      new Option(
        "--source <source>",
        "Content source (default: saved source or published)"
      ).choices(["published", "current"] as const)
    )
    .option("--channel <code>", "Follow a publishing channel")
    .option("--snapshot <id>", "Use a fixed published snapshot")
    .option("--collection <selectors...>", "Collection IDs or decoded paths, including descendants")
    .option("--all-collections", "Include all accessible collections")
    .option(
      "--output <file>",
      "Types file relative to config, or the working directory without config"
    )
    .option("--include-entry-ids", "Include entry ID types")
    .option("--no-include-entry-ids", "Omit entry ID types")
    .option("--include-entry-paths", "Include entry path types")
    .option("--no-include-entry-paths", "Omit entry path types")
    .option("--include-tree", "Include exact tree types")
    .option("--no-include-tree", "Omit exact tree types")
    .option("--check", "Compare against live metadata without writes; exit 3 if missing or stale")
    .option("--watch", "Poll in the foreground; no daemon or overlapping requests")
    .option("--interval <seconds>", "Watch polling interval, 1–300 seconds (default: 10)")
    .option(
      "--force",
      "Replace an unrelated output file; with watch, applies only until the first successful generation"
    )
    .addHelpText(
      "after",
      "\nCommit the generated file and use --check in CI. Channel/current sources follow live changes;\n--snapshot fixes the source while that snapshot is retained. Options override saved config.\nWatch holds configuration fixed; restart it after config changes. Nothing runs at install time."
    )
    .action(async (options, command) => {
      const globals = command.optsWithGlobals() as GlobalOptions & GenerateOptions;

      await executeTypes(await createCommandContext(globals, signal), options);
    });
};

export { registerTypes };
