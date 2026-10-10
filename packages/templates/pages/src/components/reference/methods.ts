/** Text colors of HTTP methods, in the badges and the navigation. */
const methodColors: Record<string, string> = {
  get: "text-emerald-500",
  post: "text-sky-500",
  put: "text-amber-500",
  patch: "text-orange-500",
  delete: "text-red-500",
  head: "text-violet-500",
  options: "text-cyan-500"
};
const methodLabels: Record<string, string> = { delete: "DEL", options: "OPT" };

const getMethodColor = (method: string): string => methodColors[method] ?? "text-gray-500";
/** A short label that fits the navigation, e.g. `DEL` for `delete`. */
const getMethodLabel = (method: string): string => methodLabels[method] ?? method.toUpperCase();

export { getMethodColor, getMethodLabel };
