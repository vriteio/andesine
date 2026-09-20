// OpenAPI query parameters cannot express mutual exclusion between parameters.
// Keep their generated value types while enforcing the API's selector rules.
type SelectorValue<T, Key extends string> = Key extends keyof T ? NonNullable<T[Key]> : never;
type Selector<T, ID extends string, Path extends string, Optional extends boolean = false> = T &
  (
    | ({ [Key in ID]: SelectorValue<T, Key> } & { [Key in Path]?: never })
    | ({ [Key in Path]: SelectorValue<T, Key> } & { [Key in ID]?: never })
    | (Optional extends true ? { [Key in ID | Path]?: never } : never)
  );
type WithSelectors<Operation extends string, Input> = Operation extends "entries.get"
  ? Selector<Input, "id", "path">
  : Operation extends "content.get" | "content.getSchema"
    ? Selector<Input, "entryID", "path">
    : "collectionPath" extends keyof Input
      ? Selector<
          Input,
          "collectionID",
          "collectionPath",
          Operation extends "content.getTree" | "schemas.get" ? false : true
        >
      : Input;

export type { WithSelectors };
