import type { ApiMediaType } from "./model";
import { toQueryEntries } from "./styles";

interface FormRequest {
  /** The media type of the body. */
  mediaType?: string;
  encoding?: ApiMediaType["encoding"];
  body?: unknown;
}

interface FormEntry {
  name: string;
  value: string;
  contentType?: string;
}

const isJSON = (mediaType?: string): boolean => /^application\/(.+\+)?json\b/.test(mediaType ?? "");
const isForm = (mediaType?: string): boolean => {
  return mediaType === "application/x-www-form-urlencoded" || mediaType === "multipart/form-data";
};
const toFormEntries = (request: FormRequest): FormEntry[] => {
  const { body } = request;
  const entries = typeof body === "object" && body !== null ? Object.entries(body) : [];

  return entries.flatMap(([name, value]): FormEntry[] => {
    const encoding = request.encoding?.[name];
    const usesStyle =
      request.mediaType === "application/x-www-form-urlencoded" ||
      encoding?.style !== undefined ||
      encoding?.explode !== undefined;

    if (usesStyle) {
      return toQueryEntries({ name, ...encoding }, value).map(([name, value]) => ({ name, value }));
    }

    return (Array.isArray(value) ? value : [value]).map((item) => {
      const contentType =
        encoding?.contentType ??
        (typeof item === "object" && item !== null ? "application/json" : undefined);

      return {
        name,
        value: typeof item === "string" && !isJSON(contentType) ? item : JSON.stringify(item),
        contentType
      };
    });
  });
};

export { isJSON, isForm, toFormEntries };
export type { FormRequest, FormEntry };
