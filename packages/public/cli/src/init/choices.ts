import { multiselect, select, text, confirm } from "@clack/prompts";
import type { AndesineClient } from "@andesine/sdk";
import type { CommandContext } from "../context";
import type { TypesConfig } from "../config/schema";
import { typesConfigSchema } from "../config/schema";
import { canPrompt } from "../prompts";
import { CLIError, exitCodes } from "../errors";
import { listCollections } from "../content/collections";
import type { InitOptions } from "./options";

type SourceMode = "published" | "current" | "snapshot";

const selectSource = async (
  context: CommandContext,
  client: AndesineClient,
  options: InitOptions,
  initial: TypesConfig["source"]
): Promise<TypesConfig["source"]> => {
  const interactive = canPrompt(options.interactive);
  const initialMode =
    initial.kind === "current" ? "current" : "snapshotID" in initial ? "snapshot" : "published";
  const explicit =
    options.source !== undefined || options.channel !== undefined || options.snapshot !== undefined;
  let mode: SourceMode = initialMode;

  if (explicit) {
    mode = options.snapshot !== undefined ? "snapshot" : (options.source ?? "published");
  } else if (interactive) {
    mode = await context.prompt((prompt) =>
      select({
        ...prompt,
        message: "Which content should types describe?",
        initialValue: initialMode,
        options: [
          {
            value: "published",
            label: "Published channel",
            hint: "Default; follows each publication"
          },
          {
            value: "current",
            label: "Current content",
            hint: "Includes unpublished schema changes"
          },
          { value: "snapshot", label: "Fixed published snapshot" }
        ]
      })
    );
  }

  if (mode === "current") return { kind: "current" };

  if (mode === "snapshot") {
    const initialSnapshot =
      initial.kind === "published" && "snapshotID" in initial ? initial.snapshotID : "";
    const snapshotID =
      options.snapshot ??
      (interactive
        ? await context.prompt((prompt) =>
            text({
              ...prompt,
              message: "Snapshot ID",
              initialValue: initialSnapshot,
              validate: (value) =>
                /^snp_[A-Za-z\d]{1,22}$/.test(value ?? "")
                  ? undefined
                  : "Enter a snapshot ID (snp_…)."
            })
          )
        : initialSnapshot);

    return { kind: "published", snapshotID };
  }

  const initialChannel =
    initial.kind === "published" && "channel" in initial ? initial.channel : "published";

  if (options.channel !== undefined || !interactive) {
    return { kind: "published", channel: options.channel ?? initialChannel };
  }

  const channels = await context.output.progress(
    "Loading publishing channels",
    () => client.publishing.listChannels({}, { signal: context.signal }),
    "Publishing channels loaded"
  );

  if (!channels.length) {
    throw new CLIError(
      "No publishing channels are available. Select --source current or create a channel in Andesine."
    );
  }

  const channel = await context.prompt((prompt) =>
    select({
      ...prompt,
      message: "Publishing channel",
      initialValue: channels.some((item) => item.code === initialChannel)
        ? initialChannel
        : undefined,
      options: channels.map((item) => ({ value: item.code, label: item.name, hint: item.code }))
    })
  );

  return { kind: "published", channel };
};

const selectTypes = async (
  context: CommandContext,
  client: AndesineClient,
  options: InitOptions,
  initial: TypesConfig
): Promise<TypesConfig> => {
  const interactive = canPrompt(options.interactive);
  const source = await selectSource(context, client, options, initial.source);
  let collections = options.allCollections ? [] : (options.collection ?? initial.collections);
  let output = options.output ?? initial.output;
  let includeEntryIDs = options.includeEntryIds ?? initial.includeEntryIDs;
  let includeEntryPaths = options.includeEntryPaths ?? initial.includeEntryPaths;
  let includeTree = options.includeTree ?? initial.includeTree;

  if (interactive && options.collection === undefined && !options.allCollections) {
    const change =
      !collections.length ||
      (await context.prompt((prompt) =>
        confirm({
          ...prompt,
          message: "Change the saved collection selection?",
          initialValue: false
        })
      ));

    if (change) {
      const available = await context.output.progress(
        "Loading collections",
        () => listCollections(client, source, context.signal),
        "Collections loaded"
      );

      if (available.length) {
        const format = await context.prompt((prompt) =>
          select({
            ...prompt,
            message: "How should collections be saved?",
            options: [
              { value: "id", label: "IDs", hint: "Stable when collections are renamed" },
              { value: "path", label: "Paths", hint: "Readable names from the explorer" }
            ]
          })
        );
        const selected = await context.prompt((prompt) =>
          multiselect({
            ...prompt,
            message: "Collections (leave empty for all)",
            required: false,
            initialValues: available
              .filter((item) => collections.includes(item.id) || collections.includes(item.path))
              .map((item) => item.id),
            options: available.map((item) => ({ value: item.id, label: item.path, hint: item.id }))
          })
        );

        collections = available
          .filter((item) => selected.includes(item.id))
          .map((item) => (format === "id" ? item.id : item.path));
      } else {
        collections = [];
        await context.output.diagnostic(
          "No collections yet. The configuration will include all collections as they become available."
        );
      }
    }
  }

  if (interactive && options.output === undefined) {
    output = await context.prompt((prompt) =>
      text({
        ...prompt,
        message: "Generated types file (relative to the configuration)",
        initialValue: output,
        validate: (value) => (value?.trim() ? undefined : "Enter an output path.")
      })
    );
  }

  const explicitIncludes =
    options.includeEntryIds !== undefined ||
    options.includeEntryPaths !== undefined ||
    options.includeTree !== undefined;

  if (interactive && !explicitIncludes) {
    const extras = await context.prompt((prompt) =>
      multiselect({
        ...prompt,
        message: "Optional generated types",
        required: false,
        initialValues: [
          includeEntryIDs ? "ids" : "",
          includeEntryPaths ? "paths" : "",
          includeTree ? "tree" : ""
        ].filter(Boolean),
        options: [
          { value: "ids", label: "Entry IDs" },
          { value: "paths", label: "Entry paths" },
          { value: "tree", label: "Exact tree structure" }
        ]
      })
    );

    includeEntryIDs = extras.includes("ids");
    includeEntryPaths = extras.includes("paths");
    includeTree = extras.includes("tree");
  }

  const parsed = typesConfigSchema.safeParse({
    source,
    collections: [...new Set(collections)],
    output,
    includeEntryIDs,
    includeEntryPaths,
    includeTree
  });

  if (!parsed.success) {
    throw new CLIError(
      "Invalid type configuration. Check the source, collection selectors, and output path.",
      exitCodes.usage
    );
  }

  return parsed.data;
};

export { selectTypes };
