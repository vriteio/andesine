import type { ApiParameter } from "./model";
import { isObject } from "./normalize";

/** A value in the default `simple` style of path and header parameters, e.g. `a,b`. */
const toSimpleValue = (value: unknown, encode: (value: unknown) => string = String): string => {
  if (Array.isArray(value)) return value.map(encode).join(",");
  if (isObject(value)) return Object.entries(value).flat().map(encode).join(",");

  return encode(value);
};
/** A value in the `simple` style; `explode` writes object values as `key=value` pairs. */
const toSimpleStyleValue = (parameter: ApiParameter, value: unknown): string => {
  if (!parameter.explode || !isObject(value)) return toSimpleValue(value);

  return Object.entries(value)
    .map(([key, item]) => `${key}=${String(item)}`)
    .join(",");
};
/** A path value in the parameter's style: `simple` by default, `label` (`.a`), or `matrix` (`;id=a`). */
const toPathValue = (parameter: ApiParameter, value: unknown): string => {
  const isObjectValue = isObject(value);
  const encode = (item: unknown): string => encodeURIComponent(String(item));
  const items = isObjectValue
    ? Object.entries(value).flatMap(([key, item]) => {
        return parameter.explode ? [`${encode(key)}=${encode(item)}`] : [encode(key), encode(item)];
      })
    : (Array.isArray(value) ? value : [value]).map(encode);

  if (parameter.style === "label") return `.${items.join(parameter.explode ? "." : ",")}`;

  if (parameter.style === "matrix") {
    return parameter.explode
      ? items.map((item) => `;${isObjectValue ? "" : `${encode(parameter.name)}=`}${item}`).join("")
      : `;${encode(parameter.name)}=${items.join(",")}`;
  }

  return items.join(",");
};
/** Query entries in the parameter's style: by default `form`, which repeats the name for each array item. */
const toQueryEntries = (
  parameter: Pick<ApiParameter, "name" | "style" | "explode">,
  value: unknown,
  encode: (value: unknown) => string = String
): Array<[string, string]> => {
  const { name, style = "form" } = parameter;
  const explode = parameter.explode ?? style === "form";
  const delimiter = { spaceDelimited: " ", pipeDelimited: "|" }[style];

  if (style === "deepObject" && isObject(value)) {
    return Object.entries(value).map(([key, item]) => [`${name}[${key}]`, encode(item)]);
  }

  if (Array.isArray(value) && delimiter) {
    return [
      [name, value.map(encode).join(style === "spaceDelimited" ? encode(delimiter) : delimiter)]
    ];
  }

  if (!explode) return [[name, toSimpleValue(value, encode)]];
  if (Array.isArray(value)) return value.map((item) => [name, encode(item)]);
  if (isObject(value)) return Object.entries(value).map(([key, item]) => [key, encode(item)]);

  return [[name, encode(value)]];
};

export { toSimpleValue, toSimpleStyleValue, toPathValue, toQueryEntries };
