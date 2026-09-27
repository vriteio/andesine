/** Reads a JSON value from session storage. Storage can be unavailable, so errors give `undefined`. */
const readSession = (key: string): unknown => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
};
const writeSession = (key: string, value: unknown): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // UI state persistence is optional.
  }
};

export { readSession, writeSession };
