import { type ExtensionArtifact } from "@andesine/contracts/extensions";
import { loadExtensionArtifact } from "./artifact";
import { createExtensionStyleSheet } from "./styles";

const loadedIconStyles = new Map<string, Promise<void>>();

/** Adopts verified manifest icon CSS once, scoped to `data-extension-icon`. */
const loadExtensionIconStyles = (name: string, artifact: ExtensionArtifact): Promise<void> => {
  const key = `${name} ${artifact.sha256}`;
  const loaded = loadedIconStyles.get(key);

  if (loaded) return loaded;

  const loading = loadExtensionArtifact(artifact).then((css) => {
    const sheet = createExtensionStyleSheet(css, name, "icon");

    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });

  // A failed load can be retried by a later render.
  loading.catch(() => loadedIconStyles.delete(key));
  loadedIconStyles.set(key, loading);

  return loading;
};

export { loadExtensionIconStyles };
