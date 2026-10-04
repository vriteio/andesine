import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

interface TemplateFile {
  /** Path inside the template; some files are renamed, see `storedNames`. */
  path: string;
  source: Uint8Array | string;
}

const templateRoot = path.join(import.meta.dirname, "../../pages-template");
const workspacePackages = ["pages", "ui"];
// npm drops `.gitignore` from packages, and pnpm would treat a `package.json` as a workspace.
const storedNames: Record<string, string> = {
  ".gitignore": "gitignore",
  "package.json": "package.template.json"
};

const readVersion = async (name: string): Promise<string> => {
  const manifest = JSON.parse(
    await readFile(path.join(templateRoot, `../${name}/package.json`), "utf8")
  );

  return manifest.version;
};
/** New sites install the published packages, so workspace links become their versions. */
const toSiteManifest = async (source: string): Promise<string> => {
  const manifest = JSON.parse(source);

  for (const name of workspacePackages) {
    manifest.dependencies[`@andesine/${name}`] = await readVersion(name);
  }

  delete manifest.private;
  manifest.name = "andesine-pages-site";

  return `${JSON.stringify(manifest, null, 2)}\n`;
};

/** The Andesine Pages template files for `andesine pages init`, without ignored files. */
const readPagesTemplate = async (): Promise<TemplateFile[]> => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: templateRoot,
    encoding: "utf8"
  })
    .split("\n")
    .filter(Boolean);

  return Promise.all(
    files.map(async (file): Promise<TemplateFile> => {
      const source = await readFile(path.join(templateRoot, file));

      const stored = storedNames[file] ?? file;

      if (file === "package.json") {
        return { path: stored, source: await toSiteManifest(source.toString("utf8")) };
      }

      return { path: stored, source };
    })
  );
};

export { readPagesTemplate };
