import { version } from "../package.json";
import { Command, Option } from "@commander-js/extra-typings";
import { createCommandContext } from "./context";
import { login } from "./auth/login";
import { logout } from "./auth/logout";
import { status } from "./auth/status";
import { init } from "./init";
import { registerAPI } from "./api/register";
import { registerTypes } from "./types/register";

/** Register custom commands and the generated public API group. */
const createProgram = (signal: AbortSignal) => {
  const program = new Command()
    .name("andesine")
    .description("Command-line tools for Andesine")
    .version(version)
    .option("--config <file>", "Use a project configuration file (ANDESINE_CONFIG)")
    .option("--profile <name>", "Select a saved user profile (ANDESINE_PROFILE)")
    .option("--base-url <url>", "Set the API root (ANDESINE_BASE_URL)")
    .option("--workspace <id>", "Select a workspace (ANDESINE_WORKSPACE_ID)")
    .option("--no-interactive", "Disable interactive prompts")
    .showHelpAfterError()
    .exitOverride();

  const auth = program.command("auth").description("Manage CLI authentication");

  program
    .command("init")
    .description("Configure this project for Andesine content and type generation")
    .addOption(
      new Option("--source <source>", "Type source: published (default) or current").choices([
        "published",
        "current"
      ] as const)
    )
    .option("--channel <code>", "Publishing channel (default: published)")
    .option("--snapshot <id>", "Use a fixed published snapshot instead of a channel")
    .option(
      "--collection <selectors...>",
      "Collection IDs or decoded paths, including collection-ID anchors"
    )
    .option("--all-collections", "Include all accessible collections")
    .option("--output <file>", "Types file relative to config (default: src/andesine.generated.ts)")
    .option("--include-entry-ids", "Include entry ID types")
    .option("--no-include-entry-ids", "Omit entry ID types")
    .option("--include-entry-paths", "Include entry path types")
    .option("--no-include-entry-paths", "Omit entry path types")
    .option("--include-tree", "Include exact tree types")
    .option("--no-include-tree", "Omit exact tree types")
    .option("--yes", "Save without confirmation, including updates to an existing config")
    .option("--generate", "Generate the configured types file after saving")
    .option("--no-generate", "Save configuration without generating types")
    .option("--no-browser", "Do not open a browser if login is needed")
    .addOption(
      new Option("--credential-store <store>", "Credential store for a new login").choices([
        "keyring",
        "file"
      ] as const)
    )
    .action(async (_options, command) => {
      await init(command.optsWithGlobals(), signal);
    });

  auth
    .command("login")
    .description("Sign in through browser device approval")
    .option("--no-browser", "Display the URL and code without opening a browser")
    .addOption(
      new Option(
        "--credential-store <store>",
        "Store credentials in the OS keyring or an unencrypted private file"
      ).choices(["keyring", "file"] as const)
    )
    .action(async (options, command) => {
      const context = await createCommandContext(command.optsWithGlobals(), signal, {
        allowNewProfile: true
      });

      await login(context, options);
    });
  auth
    .command("status")
    .description("Verify the selected credential and show its identity as JSON")
    .action(async (_options, command) => {
      await status(await createCommandContext(command.optsWithGlobals(), signal));
    });
  auth
    .command("logout")
    .description(
      "Revoke and remove the selected profile's credentials; leave API-key environment variables unchanged"
    )
    .action(async (_options, command) => {
      await logout(await createCommandContext(command.optsWithGlobals(), signal));
    });

  program.addHelpText(
    "after",
    "\nConfiguration precedence: flags > environment > project > profile > defaults.\nDefault API root: https://api.andesine.app\nAPI keys are read from ANDESINE_API_KEY by authenticated commands."
  );
  program.hook("preAction", () => {
    signal.throwIfAborted();
  });
  registerAPI(program, signal);
  registerTypes(program, signal);
  program.action(() => {
    program.outputHelp();
  });

  return program;
};

export { createProgram };
