import { Option, type CommandUnknownOpts } from "@commander-js/extra-typings";
import { createCommandContext } from "../context";
import { createOutput } from "../output";
import type { GlobalOptions } from "../config/resolve";
import { commands, schemas } from "./manifest";
import { executeAPI } from "./execute";
import type { APIOptions } from "./types";

/** Register the public spec without reading user config or credentials for help. */
const registerAPI = (program: CommandUnknownOpts, signal: AbortSignal): void => {
  const api = program
    .command("api")
    .description("Call the public API; browser-only endpoints are not exposed");
  const groups = new Map<string, CommandUnknownOpts>();

  for (const operation of commands) {
    let group = groups.get(operation.group);

    if (!group) {
      group = api.command(operation.group).description(`${operation.group} operations`);
      group.action(() => group?.outputHelp());
      groups.set(operation.group, group);
    }

    const command = group
      .command(operation.command)
      .description(operation.summary)
      .option(
        "--input <source>",
        "JSON object from @file or - (stdin); flags override matching fields"
      )
      .option("--timeout <ms>", "Request timeout in milliseconds (default: 30000; 0 disables it)")
      .option("--schema", "Print the bundled input JSON Schema without making a request");

    if (operation.conditional) {
      command.option("--if-none-match <etag>", "Read only if the published content has changed");
    }

    if (operation.response === "json" || operation.response === "empty") {
      command.option("--full", "Include HTTP status and headers with the response data");
    }

    if (operation.pagination) {
      command.option("--paginate", "Emit every page as one JSON line, retaining snapshot metadata");
    }

    if (operation.response === "binary") {
      command.option("--output <file>", "Save bytes to a new file, or use - for raw stdout");
    }

    if (operation.response === "stream") {
      command.addOption(
        new Option("--format <format>", "NDJSON events or answer text deltas")
          .choices(["json", "text"])
          .default("json")
      );
    }

    for (const field of operation.fields) {
      const argument = field.kind === "file" ? "file" : field.kind === "json" ? "json" : "value";
      const description = [
        field.schema.description,
        field.required ? "Required" : undefined,
        field.kind === "file"
          ? "File path or - for stdin"
          : field.kind === "boolean"
            ? "true or false"
            : field.kind === "json"
              ? "JSON value"
              : undefined,
        field.nullable ? "Use null to clear" : undefined
      ]
        .filter(Boolean)
        .join(". ");

      command.option(`--${field.flag} <${argument}>`, description || field.name);
    }

    const authentication = operation.security.length
      ? operation.security.map((requirement) => Object.keys(requirement).join(" + ")).join(" or ")
      : "Anonymous";

    command.addHelpText(
      "after",
      `\n${operation.description}\n\n${operation.method.toUpperCase()} ${operation.path}\nAuthentication: ${authentication}\nUse --workspace for OAuth workspace selection. JSON keys use API names, such as collectionID.\n${operation.example ? `\nExample input (pass through --input @request.json):\n${JSON.stringify(operation.example, null, 2)}\n` : ""}`
    );
    command.action(async (...args) => {
      const action = args.at(-1) as CommandUnknownOpts;
      const options = action.opts() as APIOptions;
      if (options.schema) {
        await createOutput(false).json({
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: Object.fromEntries(
            operation.fields.map((field) => [field.name, field.schema])
          ),
          required: operation.fields.filter((field) => field.required).map((field) => field.name),
          additionalProperties: false,
          components: { schemas }
        });
        return;
      }

      const context = await createCommandContext(action.optsWithGlobals() as GlobalOptions, signal);

      await executeAPI(operation, options, context);
    });
  }

  api.action(() => api.outputHelp());
};

export { registerAPI };
