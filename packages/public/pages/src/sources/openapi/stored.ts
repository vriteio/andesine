import { getCollection } from "astro:content";
import type { OpenAPISourceConfig } from "../../config";
import type { SourceData } from "../types";
import { createOpenAPISource } from "./load";
import type { ApiModel } from "./model";

interface StoredSpec {
  model: ApiModel;
}

const recordID = "spec";

/** Reads an API model that the build loaded. The model changes only when the spec loads again. */
const loadOpenAPIModel = async (source: OpenAPISourceConfig): Promise<ApiModel> => {
  const [record] = await getCollection(source.id);
  const stored = record?.data as StoredSpec | undefined;

  if (!stored) throw new Error(`Source "${source.id}": the build did not load the spec.`);

  return stored.model;
};
const loadOpenAPISource = async (
  source: OpenAPISourceConfig,
  options: { base: string; site: string }
): Promise<SourceData> => {
  return createOpenAPISource(source, await loadOpenAPIModel(source), options);
};

export { recordID, loadOpenAPIModel, loadOpenAPISource };
export type { StoredSpec };
