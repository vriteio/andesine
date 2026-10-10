import type { ExtensionManifest } from "@andesine/contracts/extensions/manifest";
import { MAX_EXTENSION_ARTIFACT_SIZE } from "@andesine/contracts/extensions/registry";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CLIError } from "../errors";
import type { createOutput } from "../output";
import { bundleFrontend } from "./frontend";
import { type ExtensionProject, loadExtensionProject } from "./project";
import { generateExtensionStyles } from "./styles";

/** A build file; publishing replaces `file` with the URL that serves it. */
interface ExtensionBuildArtifact {
  file: string;
  sha256: string;
  size: number;
}
/** `dist/extension.json`: the validated manifest and its artifacts. */
interface ExtensionBuildMetadata {
  manifest: ExtensionManifest;
  artifacts: Partial<Record<ArtifactName, ExtensionBuildArtifact>>;
}

type ArtifactName = "frontend" | "styles" | "icons";

const OUTPUT_DIRECTORY = "dist";
const DEFAULT_FRONTEND = "src/frontend/index.tsx";
const artifactFiles: Record<ArtifactName, string> = {
  frontend: "frontend.js",
  styles: "styles.css",
  icons: "icons.css"
};

const describeArtifact = (file: string, content: string): ExtensionBuildArtifact => {
  const size = Buffer.byteLength(content);

  if (size > MAX_EXTENSION_ARTIFACT_SIZE) {
    throw new CLIError(`${file} is larger than ${MAX_EXTENSION_ARTIFACT_SIZE / 1024 / 1024} MB.`);
  }

  return { file, sha256: createHash("sha256").update(content).digest("hex"), size };
};

/** Bundles the frontend and generates its CSS; empty CSS is an empty string. */
const compileExtension = async (
  project: ExtensionProject,
  output: ReturnType<typeof createOutput>
): Promise<Record<ArtifactName, string>> => {
  const { root, manifest } = project;
  const bundle = await output.progress(
    "Bundling the frontend",
    () => {
      return bundleFrontend(
        root,
        manifest,
        project.build.frontend ?? DEFAULT_FRONTEND,
        (message) => {
          void output.warning(message);
        }
      );
    },
    "Frontend bundled"
  );
  const css = await output.progress(
    "Generating the CSS",
    () => generateExtensionStyles(root, manifest, bundle.sources, project.build.icons),
    "CSS generated"
  );

  return { frontend: bundle.code, styles: css.styles, icons: css.icons };
};
/** Validates the manifest, then writes the frontend, CSS, and metadata to `dist`. */
const buildExtension = async (
  directory: string,
  output: ReturnType<typeof createOutput>
): Promise<ExtensionBuildMetadata> => {
  const root = path.resolve(directory);
  const target = path.join(root, OUTPUT_DIRECTORY);
  const project = await output.progress(
    "Loading the manifest",
    () => loadExtensionProject(root),
    "Manifest valid"
  );
  const { manifest } = project;
  const contents = await compileExtension(project, output);
  const metadata: ExtensionBuildMetadata = { manifest, artifacts: {} };

  await mkdir(target, { recursive: true });

  for (const [name, file] of Object.entries(artifactFiles) as Array<[ArtifactName, string]>) {
    const content = contents[name];

    // Empty CSS has no artifact; remove the file of an earlier build.
    if (!content) {
      await rm(path.join(target, file), { force: true });
      continue;
    }

    metadata.artifacts[name] = describeArtifact(file, content);
    await writeFile(path.join(target, file), content);
  }

  await writeFile(path.join(target, "extension.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  return metadata;
};

export { artifactFiles, buildExtension, compileExtension, describeArtifact };
export type { ArtifactName, ExtensionBuildMetadata };
