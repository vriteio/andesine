import type { ToolContext } from "./context";

interface PathCompletionOptions {
  entries?: boolean;
  /** Return paths without the leading slash, as the `{+path}` of resource URIs. */
  relative?: boolean;
}

const MAX_COMPLETIONS = 100;

/**
 * Completes a name path one level at a time: collections (with a trailing slash) and entries
 * whose names start with the last segment. Failed lookups complete nothing.
 */
const completePath = async (
  context: ToolContext,
  value: string,
  options: PathCompletionOptions = {}
): Promise<string[]> => {
  const path = `/${value.replace(/^\/+/, "")}`;
  const parentPath = path.slice(0, path.lastIndexOf("/")) || "/";
  const prefix = path.slice(path.lastIndexOf("/") + 1).toLowerCase();

  try {
    const [collections, entries] = await Promise.all([
      context.client.collections.list({ collectionPath: parentPath, limit: MAX_COMPLETIONS }),
      options.entries
        ? context.client.entries.list({ collectionPath: parentPath, limit: MAX_COMPLETIONS })
        : undefined
    ]);
    const depth = parentPath === "/" ? 1 : parentPath.split("/").length;
    const children = collections.data.filter((collection) => {
      return collection.path.split("/").length - 1 === depth;
    });
    const paths = [
      ...children.map((collection) => `${collection.path}/`),
      ...(entries?.data ?? []).map((entry) => entry.path)
    ].filter((childPath) => {
      return childPath.slice(parentPath.length).replace(/^\//, "").toLowerCase().startsWith(prefix);
    });

    return paths.map((childPath) => (options.relative ? childPath.slice(1) : childPath));
  } catch {
    return [];
  }
};
const completeChannel = async (context: ToolContext, value: string): Promise<string[]> => {
  try {
    const channels = await context.client.publishing.listChannels({});

    return channels.map(({ code }) => code).filter((code) => code.startsWith(value));
  } catch {
    return [];
  }
};

export { completeChannel, completePath };
