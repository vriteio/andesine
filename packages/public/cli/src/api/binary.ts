import { open, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CLIError } from "../errors";
import { writeOutput } from "../output";

/** Write bytes only to an explicit destination; never overwrite an existing file. */
const writeBinary = async (
  value: unknown,
  destination: string,
  signal: AbortSignal
): Promise<void> => {
  if (!(value instanceof Blob)) throw new CLIError("Expected binary data from this API operation.");

  if (destination === "-") {
    for await (const chunk of value.stream()) {
      signal.throwIfAborted();
      await writeOutput(process.stdout, Buffer.from(chunk));
    }
    return;
  }

  const file = await open(destination, "wx");
  let completed = false;

  try {
    await pipeline(Readable.fromWeb(value.stream()), file.createWriteStream(), { signal });
    completed = true;
  } finally {
    await file.close();
    if (!completed) await unlink(destination);
  }
};

export { writeBinary };
