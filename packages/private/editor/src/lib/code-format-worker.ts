import type { Plugin } from "prettier";

interface CodeFormatRequest {
  source: string;
  parser: string;
}
interface CodeFormatResponse {
  formatted?: string;
  error?: string;
}

const loadPlugins = async (parser: string): Promise<Plugin[]> => {
  switch (parser) {
    case "babel":
    case "json":
      return Promise.all([import("prettier/plugins/babel"), import("prettier/plugins/estree")]);
    case "typescript":
      return Promise.all([
        import("prettier/plugins/typescript"),
        import("prettier/plugins/estree")
      ]);
    case "html":
      return [await import("prettier/plugins/html")];
    case "css":
    case "scss":
      return [await import("prettier/plugins/postcss")];
    case "markdown":
      return [await import("prettier/plugins/markdown")];
    case "yaml":
      return [await import("prettier/plugins/yaml")];
    default:
      throw new Error("Unsupported language.");
  }
};

self.onmessage = async (event: MessageEvent<CodeFormatRequest>) => {
  try {
    const { source, parser } = event.data;
    const [prettier, plugins] = await Promise.all([
      import("prettier/standalone"),
      loadPlugins(parser)
    ]);
    const formatted = await prettier.format(source, {
      parser,
      plugins,
      tabWidth: 2,
      useTabs: false,
      printWidth: 80,
      endOfLine: "lf",
      embeddedLanguageFormatting: "off"
    });

    self.postMessage({
      formatted: formatted.replace(/^(?:[\t ]*\n)+|(?:\n[\t ]*)+$/g, "")
    } satisfies CodeFormatResponse);
  } catch {
    self.postMessage({
      error: "Could not format code. Check its syntax and try again."
    } satisfies CodeFormatResponse);
  }
};

export type { CodeFormatRequest, CodeFormatResponse };
