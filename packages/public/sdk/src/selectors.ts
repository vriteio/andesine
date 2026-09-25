// OpenAPI query parameters cannot express mutual exclusion between parameters.
// Keep their generated value types while enforcing the API's selector rules.
type SelectorValue<T, Key extends string> = Key extends keyof T ? NonNullable<T[Key]> : never;
type SelectorBranch<T, Keys extends string, Key extends Keys = Keys> = Key extends Keys
  ? { [Selected in Key]: SelectorValue<T, Selected> } & { [Other in Exclude<Keys, Key>]?: never }
  : never;
type Selector<T, Keys extends string, Optional extends boolean = false> = T &
  (SelectorBranch<T, Keys> | (Optional extends true ? { [Key in Keys]?: never } : never));
type WithSelectors<Operation extends string, Input> = Operation extends "entries.get"
  ? Selector<Input, "id" | "path" | "slugPath">
  : Operation extends "content.get" | "content.getSchema"
    ? Selector<Input, "entryID" | "path" | "slugPath">
    : "collectionPath" extends keyof Input
      ? Selector<
          Input,
          "collectionID" | "collectionPath" | "collectionSlugPath",
          Operation extends "content.getTree" | "schemas.get" ? false : true
        >
      : Input;

export type { WithSelectors };
