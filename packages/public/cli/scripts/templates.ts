import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface TemplateFile {
  /** Path inside the template; some files are renamed, see `storedNames`. */
  path: string;
  source: Uint8Array | string;
}

const publicRoot = path.join(import.meta.dirname, "../..");
const workspaceManifest = path.join(publicRoot, "../../pnpm-workspace.yaml");
const templateRoots = {
  pages: path.join(publicRoot, "../templates/pages"),
  extension: path.join(publicRoot, "../templates/extension")
};
// Workspace settings that do not belong in new projects.
const workspaceFiles = ["turbo.json"];
// npm drops `.gitignore` from packages, and pnpm would treat a `package.json` as a workspace.
const storedNames: Record<string, string> = {
  ".gitignore": "gitignore",
  "package.json": "package.template.json"
};

/** Versions of the public workspace packages, by package name. */
const readPublicVersions = async (): Promise<Map<string, string>> => {
  const directories = await readdir(publicRoot, { withFileTypes: true });
  const manifests = await Promise.all(
    directories
      .filter((directory) => directory.isDirectory())
      .map(async (directory) => {
        const file = path.join(publicRoot, directory.name, "package.json");

        return JSON.parse(await readFile(file, "utf8").catch(() => "{}"));
      })
  );

  return new Map(manifests.map((manifest) => [manifest.name, manifest.version]));
};
const readCatalogVersion = async (name: string): Promise<string> => {
  const source = await readFile(workspaceManifest, "utf8");
  const match = source.match(new RegExp(`^\\s+"?${name}"?:\\s*"?([^"\\n]+)"?$`, "m"));

  if (!match) throw new Error(`No catalog version of ${name}`);

  return match[1]!;
};
/** New projects install the published packages, so workspace and catalog ranges become versions. */
const toProjectManifest = async (source: string, name: string): Promise<string> => {
  const manifest = JSON.parse(source);
  const versions = await readPublicVersions();

  for (const group of [manifest.dependencies, manifest.devDependencies]) {
    for (const [dependency, range] of Object.entries<string>(group ?? {})) {
      if (range.startsWith("workspace:")) group[dependency] = versions.get(dependency);
      if (range === "catalog:") group[dependency] = await readCatalogVersion(dependency);
    }
  }

  delete manifest.private;
  manifest.name = name;

  return `${JSON.stringify(manifest, null, 2)}\n`;
};

/** The files of a project template for `andesine pages init` or `extensions init`. */
const readTemplate = async (template: keyof typeof templateRoots): Promise<TemplateFile[]> => {
  const templateRoot = templateRoots[template];
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: templateRoot,
    encoding: "utf8"
  })
    .split("\n")
    .filter((file) => file && !workspaceFiles.includes(file));

  return Promise.all(
    files.map(async (file): Promise<TemplateFile> => {
      const source = await readFile(path.join(templateRoot, file));
      const stored = storedNames[file] ?? file;

      if (file === "package.json") {
        const name = template === "pages" ? "andesine-pages-site" : "andesine-extension";

        return { path: stored, source: await toProjectManifest(source.toString("utf8"), name) };
      }

      return { path: stored, source };
    })
  );
};

export { readTemplate };
