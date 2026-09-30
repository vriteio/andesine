import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@scalar/json-magic/bundle";
import { fetchUrls, parseJson, parseYaml, readFiles } from "@scalar/json-magic/bundle/plugins/node";
import { validate, type ErrorObject } from "@scalar/openapi-parser";
import type { OpenAPISourceConfig } from "../../config";

interface ReadSpec {
  document: Record<string, unknown>;
  /** The local files of the spec and its references, for watching. */
  files: string[];
}

const toErrorLine = (error: ErrorObject): string => {
  const path = Array.isArray(error.path) ? error.path.join("/") : error.path;

  return `- ${path ? `${path}: ` : ""}${error.message}`;
};
/** Reads local files, like `readFiles`, and adds their paths to `files`. */
const readTrackedFiles = (files: Set<string>): ReturnType<typeof readFiles> => {
  const plugin = readFiles();

  return {
    ...plugin,
    exec: (value) => {
      files.add(resolve(value));

      return plugin.exec(value);
    }
  };
};
/**
 * Reads a spec with its external references into one document, and validates it. The spec is a
 * file relative to `root`, or an HTTPS URL.
 */
const readSpec = async (source: OpenAPISourceConfig, root: URL): Promise<ReadSpec> => {
  const label = `Source "${source.id}"`;
  const isRemote = source.spec.startsWith("https://");
  const input = isRemote ? source.spec : fileURLToPath(new URL(source.spec, root));
  const files = new Set(isRemote ? [] : [input]);

  if (!isRemote && !existsSync(input)) {
    throw new Error(
      `${label}: cannot find ${source.spec}. Use a path from the project root or an HTTPS URL.`
    );
  }

  const document = (await bundle(input, {
    plugins: [readTrackedFiles(files), fetchUrls(), parseJson(), parseYaml()],
    treeShake: false
  }).catch((error: Error) => {
    throw new Error(`${label}: cannot read ${source.spec}. ${error.message}`);
  })) as Record<string, unknown>;
  const version = String(document.openapi ?? document.swagger ?? "");

  if (!/^3\.[01]\./.test(version)) {
    throw new Error(
      `${label}: OpenAPI ${version || "without a version"} is not supported. Use 3.0 or 3.1.`
    );
  }

  const result = await validate(document);

  if (!result.valid) {
    const errors = (result.errors ?? []).slice(0, 10).map(toErrorLine);

    throw new Error(
      `${label}: ${source.spec} is not a valid OpenAPI document.\n${errors.join("\n")}`
    );
  }

  return { document, files: [...files] };
};

export { readSpec };
export type { ReadSpec };
