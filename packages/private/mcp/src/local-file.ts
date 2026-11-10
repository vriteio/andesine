import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { ReadLocalFile } from "./tools/upload";

// Relative paths resolve against the directory where the client started the server.
const readLocalFile: ReadLocalFile = async (path) => {
  const data = await readFile(resolve(path));

  return { data: new Uint8Array(data), filename: basename(path) };
};

export { readLocalFile };
