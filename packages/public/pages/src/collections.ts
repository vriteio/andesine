import config, { highlight } from "virtual:andesine/config";
import { createAndesineCollection } from "./sources/andesine/collection";
import { createFilesCollection } from "./sources/files/collection";
import { createOpenAPICollection } from "./sources/openapi/collection";

const collections = Object.fromEntries(
  config.sources.flatMap((source) => {
    if (source.type === "files") return [[source.id, createFilesCollection(source)]];
    if (source.type === "openapi") return [[source.id, createOpenAPICollection(source)]];

    return [[source.id, createAndesineCollection(source, config.base, config.site, highlight)]];
  })
);

export { collections };
