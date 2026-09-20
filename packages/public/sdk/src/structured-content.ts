interface StructuredContentSource {
  properties: Readonly<Record<string, { readonly value: unknown }>>;
  fragments: Readonly<Record<string, { readonly content: unknown }>>;
}

type StructuredContent<T extends StructuredContentSource> = Omit<T, "properties" | "fragments"> & {
  properties: { [Key in keyof T["properties"]]: T["properties"][Key]["value"] };
  fragments: { [Key in keyof T["fragments"]]: T["fragments"][Key]["content"] };
};

/**
 * Unwrap property values and fragment documents for use in application code.
 *
 * @param page - Full entry content with properties and fragments, including published list items.
 * @returns A new object with property.value and fragment.content exposed by key. Other fields,
 * including schema metadata and assets, are preserved. Nested content is shared, not cloned.
 * This helper does not validate content, convert formats, or infer collection-specific types.
 * @example
 * const tutorial = toStructuredContent(page);
 * const body = tutorial.fragments.body;
 * const enabled = tutorial.properties.enabled;
 */
const toStructuredContent = <T extends StructuredContentSource>(page: T): StructuredContent<T> =>
  ({
    ...page,
    properties: Object.fromEntries(
      Object.entries(page.properties).map(([key, property]) => [key, property.value])
    ),
    fragments: Object.fromEntries(
      Object.entries(page.fragments).map(([key, fragment]) => [key, fragment.content])
    )
  }) as StructuredContent<T>;

export { toStructuredContent };
export type { StructuredContent, StructuredContentSource };
