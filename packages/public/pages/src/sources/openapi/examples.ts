import {
  resolveSchema,
  type ApiModel,
  type ApiOperation,
  type ApiParameter,
  type ApiProperty,
  type ApiSchema
} from "./model";
import { toPathValue, toQueryEntries, toSimpleStyleValue, toSimpleValue } from "./styles";
import { createSample } from "./samples";
import { isJSON, isForm, toFormEntries, type FormRequest } from "./forms";

interface RequestSample extends FormRequest {
  method: string;
  /** The full URL, with path and query values. */
  url: string;
  headers: Array<[string, string]>;
  /** Multipart fields that upload files, e.g. `format: binary` strings. */
  files: string[];
  /** The body is a file, e.g. an `application/octet-stream` upload. */
  isFileBody: boolean;
  /** How to read the success response; examples leave out reading a response without content. */
  response?: "json" | "text";
}

interface CodeExample {
  /** `curl`, `javascript`, `python`, or the lowercase `lang` of a code sample. */
  id: string;
  label: string;
  /** The Shiki language for highlighting. */
  language: string;
  code: string;
}

interface Generator {
  label: string;
  language: string;
  generate(request: RequestSample): string;
}

const placeholderURL = "https://api.example.com";
const placeholderFile = "path/to/file";
const fileSetup = 'const file = new File(["<file content>"], "file");';
const aliases: Record<string, string> = {
  shell: "curl",
  bash: "curl",
  sh: "curl",
  js: "javascript",
  node: "javascript",
  py: "python"
};
const languages: Record<string, string> = {
  "curl": "bash",
  "javascript": "javascript",
  "typescript": "typescript",
  "ts": "typescript",
  "python": "python",
  "go": "go",
  "golang": "go",
  "ruby": "ruby",
  "php": "php",
  "java": "java",
  "kotlin": "kotlin",
  "csharp": "csharp",
  "c#": "csharp",
  "rust": "rust",
  "swift": "swift"
};

const toJSON = (value: unknown): string => JSON.stringify(value, null, 2);
const quoteShell = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
const quoteForm = (value: string): string => `"${value.replace(/[\\"]/g, "\\$&")}"`;
const encodeQueryValue = (value: unknown): string => encodeURIComponent(String(value));
/** A parameter with `content` is one value in its media type, e.g. JSON, without a style. */
const toContentValue = (parameter: ApiParameter, value: unknown): string | undefined => {
  if (parameter.mediaType === undefined || value === undefined) return undefined;

  return isJSON(parameter.mediaType) ? JSON.stringify(value) : String(value);
};
/** Binary strings: `format: binary` in OpenAPI 3.0, or a media type without an encoding in 3.1. */
const isBinary = (schema?: ApiSchema): boolean => {
  return (
    schema?.format === "binary" || Boolean(schema?.contentMediaType && !schema.contentEncoding)
  );
};
const isFile = (schema: ApiSchema, model: ApiModel): boolean => {
  const target = resolveSchema(schema, model);

  return isBinary(target) || isBinary(target?.items && resolveSchema(target.items, model));
};
/** The properties of an object schema, with those of its `allOf` parts. */
const listProperties = (schema: ApiSchema, model: ApiModel, seen: string[] = []): ApiProperty[] => {
  const target = resolveSchema(schema, model);
  const isRepeated = Boolean(schema.ref && seen.includes(schema.ref));

  if (!target || isRepeated) return [];

  const path = schema.ref ? [...seen, schema.ref] : seen;

  return [
    ...(target.properties ?? []),
    ...(target.allOf ?? []).flatMap((part) => listProperties(part, model, path))
  ];
};
/** Writes JSON values as Python literals. */
const toPython = (value: unknown, indent = ""): string => {
  const inner = `${indent}    `;

  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (!value.length) return "[]";

    return `[\n${value.map((item) => `${inner}${toPython(item, inner)}`).join(",\n")},\n${indent}]`;
  }

  const entries = Object.entries(value);

  if (!entries.length) return "{}";

  const items = entries.map(
    ([key, item]) => `${inner}${JSON.stringify(key)}: ${toPython(item, inner)}`
  );

  return `{\n${items.join(",\n")},\n${indent}}`;
};
const toBodyText = (request: RequestSample): string => {
  return !isJSON(request.mediaType) && typeof request.body === "string"
    ? request.body
    : toJSON(request.body);
};
const generators: Record<string, Generator> = {
  curl: {
    label: "cURL",
    language: "bash",
    generate: (request) => {
      const lines = [
        `curl --request ${request.method.toUpperCase()}`,
        `--url ${quoteShell(request.url)}`
      ];

      request.headers.forEach(([name, value]) => {
        lines.push(`--header ${quoteShell(`${name}: ${value}`)}`);
      });

      // `--form` reads files from values that start with `@` or `<`; `--form-string` does not.
      if (request.body !== undefined && request.mediaType === "multipart/form-data") {
        toFormEntries(request).forEach(({ name, value, contentType }) => {
          const isFile = request.files.includes(name);
          const part = isFile ? `@${placeholderFile}` : quoteForm(value);
          const type = contentType ? `;type=${contentType}` : "";

          lines.push(
            isFile || contentType
              ? `--form ${quoteShell(`${name}=${part}${type}`)}`
              : `--form-string ${quoteShell(`${name}=${value}`)}`
          );
        });
      } else if (request.body !== undefined && isForm(request.mediaType)) {
        toFormEntries(request).forEach(({ name, value }) => {
          lines.push(`--data-urlencode ${quoteShell(`${name}=${value}`)}`);
        });
      } else if (request.isFileBody) {
        lines.push(`--data-binary ${quoteShell(`@${placeholderFile}`)}`);
      } else if (request.body !== undefined) {
        lines.push(`--data-raw ${quoteShell(toBodyText(request))}`);
      }

      return lines.join(" \\\n  ");
    }
  },
  javascript: {
    label: "JavaScript",
    language: "javascript",
    generate: (request) => {
      const headers = request.headers.filter(([name]) => {
        return !(request.mediaType === "multipart/form-data" && name === "Content-Type");
      });
      const options = [`  method: ${JSON.stringify(request.method.toUpperCase())}`];
      const setup: string[] = [];

      if (headers.length) {
        const entries = headers.map(
          ([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`
        );

        options.push(`  headers: {\n${entries.join(",\n")}\n  }`);
      }

      if (request.body !== undefined && isForm(request.mediaType)) {
        const form = request.mediaType === "multipart/form-data" ? "FormData" : "URLSearchParams";

        if (request.files.length) setup.push(fileSetup);

        setup.push(`const body = new ${form}();`);
        toFormEntries(request).forEach(({ name, value, contentType }) => {
          const isFile = request.files.includes(name);
          const item = isFile ? "file" : JSON.stringify(value);
          const part = contentType
            ? `new Blob([${item}], { type: ${JSON.stringify(contentType)} })`
            : item;
          const filename = contentType ? (isFile ? ", file.name" : ', ""') : "";

          setup.push(`body.append(${JSON.stringify(name)}, ${part}${filename});`);
        });
        options.push("  body");
      } else if (request.isFileBody) {
        setup.push(fileSetup);
        options.push("  body: file");
      } else if (request.body !== undefined) {
        const body = isJSON(request.mediaType)
          ? `JSON.stringify(${toJSON(request.body).replaceAll("\n", "\n  ")})`
          : JSON.stringify(toBodyText(request));

        options.push(`  body: ${body}`);
      }

      return [
        ...(setup.length ? [setup.join("\n"), ""] : []),
        `const response = await fetch(${JSON.stringify(request.url)}, {\n${options.join(",\n")}\n});`,
        ...(request.response ? ["", `const data = await response.${request.response}();`] : [])
      ].join("\n");
    }
  },
  python: {
    label: "Python",
    language: "python",
    generate: (request) => {
      const headers = request.headers.filter(([name]) => {
        return request.mediaType !== "multipart/form-data" || name !== "Content-Type";
      });
      const method = request.method.toLowerCase();
      // `requests` has no function for TRACE.
      const isTrace = method === "trace";
      const args = [...(isTrace ? ['    "TRACE"'] : []), `    ${JSON.stringify(request.url)}`];

      if (headers.length) args.push(`    headers=${toPython(Object.fromEntries(headers), "    ")}`);

      if (request.body !== undefined && isJSON(request.mediaType)) {
        args.push(
          request.body === null ? '    data="null"' : `    json=${toPython(request.body, "    ")}`
        );
      } else if (request.body !== undefined && request.mediaType === "multipart/form-data") {
        const entries = toFormEntries(request);
        const files = entries.map(({ name, value, contentType }) => {
          const isFile = request.files.includes(name);
          const item = isFile
            ? `open(${JSON.stringify(placeholderFile)}, "rb")`
            : JSON.stringify(value);
          const filename = isFile ? '"file"' : "None";
          const type = contentType ? `, ${JSON.stringify(contentType)}` : "";
          const part = `(${filename}, ${item}${type})`;

          return `        (${JSON.stringify(name)}, ${part}),`;
        });

        if (files.length) args.push(`    files=[\n${files.join("\n")}\n    ]`);
      } else if (request.isFileBody) {
        args.push(`    data=open(${JSON.stringify(placeholderFile)}, "rb")`);
      } else if (request.body !== undefined) {
        const body = isForm(request.mediaType)
          ? toPython(
              toFormEntries(request).map(({ name, value }) => [name, value]),
              "    "
            )
          : JSON.stringify(toBodyText(request));

        args.push(`    data=${body}`);
      }

      const output = {
        json: "response.json()",
        text: "response.text",
        none: "response.status_code"
      }[request.response ?? "none"];

      return [
        "import requests",
        "",
        `response = requests.${isTrace ? "request" : method}(\n${args.join(",\n")},\n)`,
        "",
        `print(${output})`
      ].join("\n");
    }
  }
};

/**
 * Adds placeholders for the schemes of the first security requirement, which all apply. A request
 * has one `Authorization` header, so only the first scheme that uses it adds it.
 */
const addCredentials = (
  operation: ApiOperation,
  model: ApiModel,
  headers: Array<[string, string]>,
  query: Map<string, string[]>,
  cookies: Map<string, string>
): void => {
  // A credential replaces a header parameter with the same name, e.g. an API key.
  const setHeader = (name: string, value: string): void => {
    const index = headers.findIndex(([item]) => item.toLowerCase() === name.toLowerCase());

    if (index === -1) headers.push([name, value]);
    else headers[index] = [name, value];
  };
  const setAuthorization = (value: string): void => {
    if (!headers.some(([name]) => name === "Authorization")) headers.push(["Authorization", value]);
  };

  Object.keys(operation.security[0] ?? {}).forEach((id) => {
    const scheme = model.securitySchemes.find((item) => item.id === id);
    const httpScheme = scheme?.scheme?.toLowerCase();
    const usesToken = scheme?.type === "oauth2" || scheme?.type === "openIdConnect";

    if (scheme?.type === "http" && httpScheme === "basic") {
      setAuthorization("Basic <credentials>");
    } else if (usesToken || (scheme?.type === "http" && httpScheme === "bearer")) {
      setAuthorization("Bearer <token>");
    } else if (scheme?.type === "http" && scheme.scheme) {
      const name = `${scheme.scheme[0]!.toUpperCase()}${scheme.scheme.slice(1)}`;

      setAuthorization(`${name} <credentials>`);
    } else if (scheme?.type === "apiKey" && scheme.name && scheme.in === "header") {
      setHeader(scheme.name, "<api-key>");
    } else if (scheme?.type === "apiKey" && scheme.name && scheme.in === "query") {
      query.set(scheme.name, [encodeQueryValue("<api-key>")]);
    } else if (scheme?.type === "apiKey" && scheme.name && scheme.in === "cookie") {
      cookies.set(scheme.name, "<api-key>");
    }
  });
};
/**
 * Creates the sample request of an operation: path values, required query, header, and cookie
 * values, and parameters with examples, credential placeholders, and a body from examples or the
 * schema.
 */
const createRequestSample = (operation: ApiOperation, model: ApiModel): RequestSample => {
  const headers: Array<[string, string]> = [];
  const query = new Map<string, string[]>();
  // Cookies by name, so a credential replaces a cookie parameter with the same name.
  const cookies = new Map<string, string>();
  const media = operation.requestBody?.contents[0];
  const isMultipart = media?.type === "multipart/form-data";
  const isFileBody = Boolean(media?.schema && !isForm(media.type) && isFile(media.schema, model));
  const files = (isMultipart && media.schema ? listProperties(media.schema, model) : [])
    .filter((property) => isFile(property.schema, model))
    .map((property) => property.name);
  const success =
    operation.responses.find((response) => response.status.startsWith("2")) ??
    operation.responses.find((response) => response.status === "default");
  const responseMedia = success?.contents[0];
  const server = (operation.servers[0]?.url ?? placeholderURL).replace(/\/$/, "");
  const toValue = (parameter: ApiOperation["parameters"][number]): unknown => {
    const example = parameter.examples[0]?.value;

    return example === undefined
      ? parameter.schema && createSample(parameter.schema, model, "request")
      : example;
  };
  let path = operation.path;

  operation.parameters.forEach((parameter) => {
    const value = toValue(parameter);
    const isShown = parameter.required || parameter.examples.length > 0;
    const content = toContentValue(parameter, value);

    if (parameter.in === "path") {
      const text =
        content === undefined
          ? toPathValue(parameter, value === undefined ? parameter.name : value)
          : encodeURIComponent(content);

      path = path.replace(`{${parameter.name}}`, text);
    } else if (parameter.in === "query" && isShown && value !== undefined) {
      const entries: Array<[string, string]> =
        content === undefined
          ? toQueryEntries(parameter, value, encodeQueryValue)
          : [[parameter.name, encodeQueryValue(content)]];

      entries.forEach(([name, item]) => query.set(name, [...(query.get(name) ?? []), item]));
    } else if (parameter.in === "header" && isShown && value !== undefined) {
      headers.push([parameter.name, content ?? toSimpleStyleValue(parameter, value)]);
    } else if (parameter.in === "cookie" && isShown && value !== undefined) {
      cookies.set(parameter.name, encodeURIComponent(content ?? toSimpleValue(value)));
    }
  });
  addCredentials(operation, model, headers, query, cookies);

  if (cookies.size) {
    headers.push(["Cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; ")]);
  }

  const example = media?.examples[0]?.value;
  const body =
    example === undefined ? media?.schema && createSample(media.schema, model, "request") : example;
  const queryString = [...query]
    .flatMap(([name, values]) => values.map((value) => `${encodeQueryValue(name)}=${value}`))
    .join("&");
  const search = queryString ? `?${queryString}` : "";

  if (media && body !== undefined) headers.push(["Content-Type", media.type]);

  return {
    method: operation.method,
    url: `${server}${path}${search}`,
    headers,
    mediaType: media?.type,
    encoding: media?.encoding,
    body,
    files,
    isFileBody,
    response: responseMedia && (isJSON(responseMedia.type) ? "json" : "text")
  };
};
/**
 * Lists the request examples of an operation: cURL, JavaScript, and Python, where a code sample
 * from `x-codeSamples` with the same language replaces the generated one. Other samples follow.
 */
const createCodeExamples = (operation: ApiOperation, model: ApiModel): CodeExample[] => {
  const request = createRequestSample(operation, model);
  const samples = operation.codeSamples.map((sample): CodeExample => {
    const lang = sample.lang.toLowerCase();
    const id = aliases[lang] ?? lang;

    return {
      id,
      label: sample.label,
      language: languages[id] ?? languages[lang] ?? "text",
      code: sample.source
    };
  });
  const generated = Object.entries(generators).map(([id, generator]): CodeExample => {
    return (
      samples.find((sample) => sample.id === id) ?? {
        id,
        label: generator.label,
        language: generator.language,
        code: generator.generate(request)
      }
    );
  });
  const counts = new Map<string, number>();

  // Tabs need unique labels, so a repeated label gets a number, e.g. `Python 2`.
  return [...generated, ...samples.filter((sample) => !generated.includes(sample))].map(
    (example) => {
      const count = (counts.get(example.label) ?? 0) + 1;

      counts.set(example.label, count);

      return count > 1 ? { ...example, label: `${example.label} ${count}` } : example;
    }
  );
};

export { createRequestSample, createCodeExamples, isJSON };
export type { RequestSample, CodeExample };
