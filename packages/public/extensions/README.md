# @andesine/extensions

Authoring tools for [Andesine](https://andesine.app) extensions: the manifest, Solid.js views that
run in a sandbox, element views, pages, block actions, and API access.

## Install

Create a new extension with the CLI:

```sh
npx andesine extensions init hello --name acme/hello
```

Or add the package to an existing project:

```sh
npm install @andesine/extensions
```

## Example

```ts
import { defineExtension, viewRefs } from "@andesine/extensions";
import type { Views } from "./src/views";

const View = viewRefs<Views>();

export default defineExtension({
  name: "acme/hello",
  version: "0.1.0",
  displayName: "Hello",
  apiVersion: 1,
  permissions: ["read:entries"],
  panels: [{ id: "hello", side: "right", name: "Hello", icon: "i-lucide:hand", view: View.Hello }]
});
```

## Documentation

- [Build extensions](https://andesine.app/docs/extensions/build-extensions/)
- [Use extensions](https://andesine.app/docs/extensions/use-extensions/)

## License

MIT
