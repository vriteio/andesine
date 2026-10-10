import type { Command } from "@commander-js/extra-typings";
import type { GlobalOptions } from "../config/resolve";
import { createCommandContext } from "../context";
import path from "node:path";
import { CLIError } from "../errors";
import { createOutput } from "../output";
import { buildExtension } from "./build";
import { removeDevelopment } from "./dev/remove";
import { runDevelopment } from "./dev/run";
import { sendTestEvent } from "./dev/test-event";
import { buildRegistry } from "./registry/build";
import { checkRegistry } from "./registry/check";
import { initExtension } from "./init";
import {
  checkExtensionKey,
  generateExtensionKey,
  KEY_ENVIRONMENT_VARIABLE,
  revokeExtensionKey
} from "./keys";
import { KEYS_FILE } from "./project";

const ROOT_DESCRIPTION = "Extension directory (default: current directory)";

const formatVersions = (manifests: Array<{ name: string; version: string }>): string => {
  return manifests.map(({ name, version }) => `${name}@${version}`).join(", ");
};
const reportRegistryErrors = async (
  output: ReturnType<typeof createOutput>,
  errors: string[]
): Promise<void> => {
  if (!errors.length) return;

  for (const error of errors) await output.error(error);

  throw new CLIError(`The registry has ${errors.length} problem(s).`);
};

const registerExtensions = (program: Command, signal: AbortSignal): void => {
  const getOutput = (command: { optsWithGlobals(): object }) => {
    return createOutput((command.optsWithGlobals() as GlobalOptions).interactive, signal);
  };
  const extensions = program.command("extensions").description("Create and build extensions");
  const keys = extensions.command("keys").description("Manage the extension backend keys");

  extensions
    .command("init")
    .description("Create an extension with a backend from the template in a new or empty directory")
    .argument("[directory]", "Directory of the new extension", "extension")
    .option("--name <scope/name>", "Registry name of the extension (default: example/hello)")
    .action(async (directory, options, command) => {
      await initExtension(directory, options, getOutput(command));
    });
  extensions
    .command("build")
    .description("Validate the manifest, then build the frontend, CSS, and dist/extension.json")
    .option("--root <directory>", ROOT_DESCRIPTION, ".")
    .action(async (options, command) => {
      const output = getOutput(command);
      const { manifest, artifacts } = await buildExtension(options.root, output);

      await output.note(`${manifest.name}@${manifest.version}`, {
        Frontend: `${artifacts.frontend?.size} bytes`,
        Styles: artifacts.styles && `${artifacts.styles.size} bytes`,
        Icons: artifacts.icons && `${artifacts.icons.size} bytes`
      });
    });

  extensions
    .command("dev")
    .description(
      "Run the extension on a local instance for you: upload each build, reload on changes, stop on exit"
    )
    .option("--root <directory>", ROOT_DESCRIPTION, ".")
    .option("--env-file <file>", "The local backend's environment file", ".env")
    .option(
      "--backend <url>",
      "Local backend URL in place of the manifest's, e.g. http://localhost:3000"
    )
    .option("--remove", "Uninstall the development extension and delete its development state")
    .addHelpText(
      "after",
      "\nNeeds a local instance with EXTENSIONS_DEVELOPMENT_ENABLED=true, andesine auth login, and a\nworkspace. The backend's environment file gets the development key and the instance URL."
    )
    .action(async (options, command) => {
      const context = await createCommandContext(
        command.optsWithGlobals() as GlobalOptions,
        signal
      );

      if (options.remove) await removeDevelopment(context, options.root);
      else await runDevelopment(context, options);
    });
  extensions
    .command("test-event")
    .description("Send a sample event to a webhook of the development extension")
    .argument("<webhook>", "Webhook ID from the manifest")
    .argument("<type>", "Event type, e.g. entry.created")
    .option("--root <directory>", ROOT_DESCRIPTION, ".")
    .action(async (webhookID, type, options, command) => {
      const context = await createCommandContext(
        command.optsWithGlobals() as GlobalOptions,
        signal
      );

      await sendTestEvent(context, { root: options.root, webhookID, type });
    });

  const registry = extensions
    .command("registry")
    .description("Check and build an extension registry repository (for its CI)");

  registry
    .command("check")
    .description("Check every extension of the repository against the published registry")
    .option("--repository <directory>", "Registry repository", ".")
    .requiredOption("--published <directory>", "Checkout of the published registry site")
    .action(async (options, command) => {
      const output = getOutput(command);
      const result = await checkRegistry(
        path.resolve(options.repository),
        path.resolve(options.published),
        output
      );

      await reportRegistryErrors(output, result.errors);
      await output.success(
        `The registry is valid; new versions: ${formatVersions(result.newVersions.map(({ entry }) => entry.project.manifest)) || "none"}.`
      );
    });
  registry
    .command("build")
    .description("Write new versions and the index to the published registry site")
    .option("--repository <directory>", "Registry repository", ".")
    .requiredOption("--published <directory>", "Checkout of the published registry site")
    .requiredOption("--site-url <url>", "HTTPS URL that serves the published site")
    .option("--commit <sha>", "Repository commit of the build (default: HEAD)")
    .action(async (options, command) => {
      const output = getOutput(command);
      const result = await buildRegistry(
        {
          repository: path.resolve(options.repository),
          published: path.resolve(options.published),
          siteURL: options.siteUrl,
          commit: options.commit
        },
        output
      );

      await reportRegistryErrors(output, result.errors);
      await output.success(`Published: ${result.published.join(", ") || "no new versions"}.`);
    });

  keys
    .command("generate")
    .description(`Generate an Ed25519 key; add its public key to ${KEYS_FILE}`)
    .option("--root <directory>", ROOT_DESCRIPTION, ".")
    .option("--kid <id>", "Key ID (default: key-<date>)")
    .option("--print", "Print the private JWK for a secret manager instead of saving it")
    .action(async (options, command) => {
      const output = getOutput(command);
      const root = path.resolve(options.root);
      const key = await generateExtensionKey(root, options);

      if (!key.file) {
        await output.text(`${key.privateKey}\n`);

        return;
      }

      const file = path.relative(process.cwd(), key.file);

      if (!key.ignored) await output.warning(`Git does not ignore ${file}. Never commit it.`);

      await output.note(`Key ${key.kid}`, {
        "Private key": file,
        "Backend": `Set ${KEY_ENVIRONMENT_VARIABLE} to the file content`
      });
    });
  keys
    .command("check")
    .description(
      `Check that the private key in ${KEY_ENVIRONMENT_VARIABLE} or --key matches a current key`
    )
    .option("--root <directory>", ROOT_DESCRIPTION, ".")
    .option("--key <file>", "Private JWK file")
    .option("--registry <url>", "Also check the key in this registry index")
    .action(async (options, command) => {
      const output = getOutput(command);
      const result = await checkExtensionKey(path.resolve(options.root), options);

      await output.success(
        `Key ${result.kid} is a current key of ${result.name}${result.registry ? " in the registry" : ""}.`
      );
    });
  keys
    .command("revoke")
    .description(`Remove a key from ${KEYS_FILE} and list it as revoked`)
    .argument("<kid>", "Key ID")
    .option("--root <directory>", ROOT_DESCRIPTION, ".")
    .action(async (kid, options, command) => {
      const output = getOutput(command);

      await revokeExtensionKey(path.resolve(options.root), kid);
      await output.success(`Key ${kid} is revoked. Publish a new version to stop using it.`);
    });
};

export { registerExtensions };
