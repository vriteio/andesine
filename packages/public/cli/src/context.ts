import {
  resolveConfig,
  type GlobalOptions,
  type ResolvedConfig,
  type ResolveConfigOptions
} from "./config/resolve";
import { createOutput } from "./output";
import { createPrompt } from "./prompts";

interface CommandContext {
  config: ResolvedConfig;
  signal: AbortSignal;
  output: ReturnType<typeof createOutput>;
  prompt: ReturnType<typeof createPrompt>;
}

/** Create context inside command actions so help and version never read configuration. */
const createCommandContext = async (
  flags: GlobalOptions,
  signal: AbortSignal,
  options: Pick<ResolveConfigOptions, "allowNewProfile" | "allowMissingConfig"> = {}
): Promise<CommandContext> => {
  signal.throwIfAborted();

  const config = await resolveConfig({ flags, ...options });

  signal.throwIfAborted();

  return {
    config,
    signal,
    output: createOutput(flags.interactive, signal),
    prompt: createPrompt(signal, flags.interactive)
  };
};

export { createCommandContext };
export type { CommandContext };
