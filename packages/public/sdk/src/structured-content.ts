interface StructuredContentSource {
  properties: Readonly<Record<string, { readonly value: unknown } | undefined>>;
  fragments: Readonly<Record<string, { readonly content: unknown } | undefined>>;
}

type PropertyValue<T> = T extends { readonly value: infer Value } ? Value : undefined;
type FragmentContent<T> = T extends { readonly content: infer Content } ? Content : undefined;
type StructuredContent<T extends StructuredContentSource> = T extends unknown
  ? Omit<T, "properties" | "fragments"> & {
      properties: { [Key in keyof T["properties"]]: PropertyValue<T["properties"][Key]> };
      fragments: { [Key in keyof T["fragments"]]: FragmentContent<T["fragments"][Key]> };
    }
  : never;

/**
 * Unwrap property values and fragment documents for use in application code.
 *
 * @param page - Full entry content with properties and fragments, including published list items.
 * @returns A new object with property.value and fragment.content exposed by key. Other fields,
 * including schema metadata and assets, are preserved. Nested content is shared, not cloned.
 * Workspace field types and revision unions are preserved. This helper does not validate content or convert formats.
 * @example
 * const tutorial = toStructuredContent(page);
 * const body = tutorial.fragments.body;
 * const enabled = tutorial.properties.enabled;
 */
const toStructuredContent = <T extends StructuredContentSource>(page: T): StructuredContent<T> =>
  ({
    ...page,
    properties: Object.fromEntries(
      Object.entries(page.properties).map(([key, property]) => [key, property?.value])
    ),
    fragments: Object.fromEntries(
      Object.entries(page.fragments).map(([key, fragment]) => [key, fragment?.content])
    )
  }) as unknown as StructuredContent<T>;

export { toStructuredContent };
export type { StructuredContent, StructuredContentSource };
