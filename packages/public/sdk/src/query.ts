// oRPC represents nested query values with indexed bracket notation.
const serializeQuery = (query: Record<string, unknown>): string => {
  const parameters = new URLSearchParams();
  const escapeKey = (key: string) => key.replace(/[\\[\]]/g, (character) => `\\${character}`);
  const append = (path: string, value: unknown): void => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${path}[${index}]`, item));
    } else if (typeof value === "object") {
      for (const [key, item] of Object.entries(value)) append(`${path}[${escapeKey(key)}]`, item);
    } else {
      parameters.append(path, String(value));
    }
  };

  for (const [key, value] of Object.entries(query)) append(escapeKey(key), value);

  return parameters.toString();
};

export { serializeQuery };
