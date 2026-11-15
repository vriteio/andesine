interface WebMCPOptions {
  workspaceID: string;
  /** ID of the entry open in the editor, if any. */
  openEntryID: () => string | undefined;
  openEntry: (entryID: string) => void;
  /** Aborting it unregisters the tools. */
  signal: AbortSignal;
}

/** Registers workspace tools for in-browser AI agents; loads them only with WebMCP support. */
const registerWebMCPTools = (options: WebMCPOptions): void => {
  if (!("modelContext" in document)) return;

  import("./tools")
    .then(({ registerTools }) => registerTools(options))
    .catch((error: unknown) => console.warn(error));
};

export { registerWebMCPTools };
export type { WebMCPOptions };
