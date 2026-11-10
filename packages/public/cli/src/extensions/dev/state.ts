import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CommandContext } from "../../context";
import { CLIError, exitCodes } from "../../errors";
import { exists, WORK_DIRECTORY } from "../project";

/** The development extension of a project on one instance and workspace. */
interface DevelopmentState {
  baseURL: string;
  workspaceID: string;
  extensionID: string;
}

const getStateFile = (root: string) => path.join(root, WORK_DIRECTORY, "development.json");

const saveDevelopmentState = async (root: string, state: DevelopmentState): Promise<void> => {
  await writeFile(getStateFile(root), `${JSON.stringify(state, null, 2)}\n`);
};
/** The recorded development extension for the selected instance and workspace. */
const readDevelopmentState = async (
  root: string,
  context: CommandContext
): Promise<DevelopmentState> => {
  const file = getStateFile(root);
  const state = (await exists(file))
    ? (JSON.parse(await readFile(file, "utf8")) as DevelopmentState)
    : null;
  const isSelected =
    state?.baseURL === context.config.baseURL && state.workspaceID === context.config.workspaceID;

  if (!isSelected) {
    throw new CLIError(
      "No development extension for this instance and workspace. Run andesine extensions dev first.",
      exitCodes.usage
    );
  }

  return state!;
};
const clearDevelopmentState = async (root: string): Promise<void> => {
  await rm(getStateFile(root), { force: true });
};

export { saveDevelopmentState, readDevelopmentState, clearDevelopmentState };
export type { DevelopmentState };
