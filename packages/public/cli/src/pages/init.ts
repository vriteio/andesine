import { cp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIError, exitCodes } from "../errors";
import type { createOutput } from "../output";

// The build copies the template next to the bundled CLI; see `scripts/pages-template.ts`.
const templateDirectory = fileURLToPath(new URL("./templates/pages/", import.meta.url));

const isEmptyDirectory = async (directory: string): Promise<boolean> => {
  try {
    return (await readdir(directory)).length === 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;

    throw error;
  }
};
/** Package names allow lowercase letters, digits, and `-._~` only. */
const toPackageName = (directory: string): string => {
  const name = path
    .basename(directory)
    .toLowerCase()
    .replace(/[^a-z\d._~-]+/g, "-");

  return name.replace(/^[._-]+|[-]+$/g, "") || "andesine-pages-site";
};

/** Creates an Andesine Pages site from the template in an empty directory. */
const initPages = async (
  directory: string,
  output: ReturnType<typeof createOutput>
): Promise<void> => {
  const target = path.resolve(directory);
  const manifestPath = path.join(target, "package.json");

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
        await readFile(path.join(templateDirectory, "package.template.json"), "utf8")
      );

      await cp(templateDirectory, target, { recursive: true });
      await rename(path.join(target, "gitignore"), path.join(target, ".gitignore"));
      await rm(path.join(target, "package.template.json"));
      await writeFile(
        manifestPath,
        `${JSON.stringify({ ...manifest, name: toPackageName(target) }, null, 2)}\n`
      );
    },
    "Template copied"
  );
  await output.note("Next steps", {
    "Open the site": `cd ${path.relative(process.cwd(), target) || "."}`,
    "Install": "npm install",
    "Start": "npm run dev"
  });
};

export { initPages };
