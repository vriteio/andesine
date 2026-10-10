import path from "node:path";
import type { CommandContext } from "../../context";
import { createDevelopmentClient } from "./client";
import { clearDevelopmentState, readDevelopmentState } from "./state";

/** Uninstalls the project's development extension, which deletes its development state. */
const removeDevelopment = async (context: CommandContext, root: string): Promise<void> => {
  const directory = path.resolve(root);
  const client = createDevelopmentClient(context);
  const { extensionID } = await readDevelopmentState(directory, context);

  await context.output.progress(
    "Removing the development extension",
    () => client.remove(extensionID),
    "Development extension removed"
  );
  await clearDevelopmentState(directory);
  await context.output.success("The development extension and its state are removed.");
};

export { removeDevelopment };
