import { cp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIError, exitCodes } from "../errors";
import type { createOutput } from "../output";

const isEmptyDirectory = async (directory: string): Promise<boolean> => {
  try {
    return (await readdir(directory)).length === 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;

    throw error;
  }
};
/** Package names allow lowercase letters, digits, and `-._~` only. */
const toPackageName = (directory: string, fallback: string): string => {
  const name = path
    .basename(directory)
    .toLowerCase()
    .replace(/[^a-z\d._~-]+/g, "-");

  return name.replace(/^[._-]+|[-]+$/g, "") || fallback;
};
/** Copies a bundled template (see `scripts/templates.ts`) into a new or empty directory. */
const copyTemplate = async (
  template: "pages" | "extension",
  directory: string,
  output: ReturnType<typeof createOutput>
): Promise<string> => {
  const source = fileURLToPath(new URL(`./templates/${template}/`, import.meta.url));
  const target = path.resolve(directory);

  if (!(await isEmptyDirectory(target))) {
    throw new CLIError(
      `${directory} is not empty. Choose a new or empty directory.`,
      exitCodes.usage
    );
  }

  await output.progress(
    "Copying the template",
    async () => {
      const manifest = JSON.parse(
        await readFile(path.join(source, "package.template.json"), "utf8")
      );
      const name = toPackageName(target, manifest.name);

      await cp(source, target, { recursive: true });
      await rename(path.join(target, "gitignore"), path.join(target, ".gitignore"));
      await rm(path.join(target, "package.template.json"));
      await writeFile(
        path.join(target, "package.json"),
        `${JSON.stringify({ ...manifest, name }, null, 2)}\n`
      );
    },
    "Template copied"
  );

  return target;
};

/** Creates an Andesine Pages site from the template in an empty directory. */
const initPages = async (
  directory: string,
  output: ReturnType<typeof createOutput>
): Promise<void> => {
  const target = await copyTemplate("pages", directory, output);

  await output.note("Next steps", {
    "Open the site": `cd ${path.relative(process.cwd(), target) || "."}`,
    "Install": "npm install",
    "Start": "npm run dev"
  });
};

export { copyTemplate, initPages };
