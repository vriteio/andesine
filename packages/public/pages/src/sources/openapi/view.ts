import { toHtml } from "hast-util-to-html";
import { highlightCode, type HighlightOptions } from "../../content/prepare";
import { createCodeExamples, isJSON } from "./examples";
import {
  createFieldBuilder,
  toHTML,
  toID,
  type FieldView,
  type MediaView,
  type VariantView
} from "./fields";
import { toSchemeLabel, toStatusLabel } from "./labels";
import type { ApiMediaType, ApiModel, ApiOperation, ApiParameter } from "./model";
import { createSample } from "./samples";

interface OperationView {
  /** Prefix of element IDs, so several operations can be on one page. Empty on reference pages. */
  anchor: string;
  /** Shown in another page, not on the operation's reference page. */
  embedded: boolean;
  title: string;
  /** The URL of the operation's reference page. */
  href: string;
  method: string;
  path: string;
  deprecated: boolean;
  /** HTML. */
  description?: string;
  servers: ServerView[];
  /** Alternative requirements; each lists the schemes that a request needs together. */
  security: SecuritySchemeView[][];
  parameters: ParameterGroupView[];
  requestBody?: RequestBodyView;
  responses: ResponseView[];
  /** Request examples, by language. */
  examples: CodeView[];
  /** The first example of each response that has one. */
  responseExamples: CodeView[];
}

interface ServerView {
  url: string;
  description?: string;
}

interface SecuritySchemeView {
  id: string;
  /** The scheme's kind, e.g. `http, bearer`. */
  label: string;
  /** HTML. */
  description?: string;
  scopes: string[];
}

interface ParameterGroupView {
  id: string;
  /** E.g. `Query parameters`. */
  label: string;
  fields: FieldView[];
}

interface RequestBodyView {
  id: string;
  required: boolean;
  /** HTML. */
  description?: string;
  contents: MediaView[];
}

interface ResponseView {
  id: string;
  status: string;
  /** The status text, e.g. `Not Found`. */
  label?: string;
  /** HTML. */
  description?: string;
  headers: FieldView[];
  contents: MediaView[];
}

interface CodeView {
  label: string;
  language: string;
  code: string;
  /** Highlighted HTML of the code, for the inside of a `pre` element. */
  html: string;
}

/** The parts of an operation to show. Embeds leave out the examples by default. */
interface OperationParts {
  description?: boolean;
  authentication?: boolean;
  parameters?: boolean;
  requestBody?: boolean;
  responses?: boolean;
  /** Request and response examples. */
  examples?: boolean;
}

interface ViewOptions {
  highlight: HighlightOptions;
  title: string;
  href: string;
  /** Set for embedded operations. */
  anchor?: string;
  parts?: OperationParts;
}

const locations: Array<[ApiParameter["in"], string]> = [
  ["path", "Path parameters"],
  ["query", "Query parameters"],
  ["header", "Headers"],
  ["cookie", "Cookies"]
];

const toPlainText = (value = ""): string => value.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
const toCodeView = async (
  label: string,
  language: string,
  code: string,
  highlight: HighlightOptions
): Promise<CodeView> => {
  const pre = await highlightCode(code, language, highlight);

  return { label, language, code, html: toHtml(pre.children) };
};
const toResponseExample = async (
  media: ApiMediaType | undefined,
  label: string,
  model: ApiModel,
  highlight: HighlightOptions
): Promise<CodeView | undefined> => {
  const example = media?.examples[0]?.value;
  const value =
    example === undefined
      ? media?.schema && createSample(media.schema, model, "response")
      : example;

  if (value === undefined) return undefined;

  const json = isJSON(media?.type) || typeof value !== "string";

  return toCodeView(
    label,
    json ? "json" : "text",
    json ? JSON.stringify(value, null, 2) : String(value),
    highlight
  );
};
/**
 * Resolves an operation for the template: HTML descriptions, field trees with anchors,
 * highlighted request examples, and response examples.
 */
const createOperationView = async (
  operation: ApiOperation,
  model: ApiModel,
  options: ViewOptions
): Promise<OperationView> => {
  const { highlight, anchor = "" } = options;
  const builder = createFieldBuilder(model, highlight);
  const show = (part: keyof OperationParts): boolean => {
    return options.parts?.[part] ?? (part !== "examples" || options.anchor === undefined);
  };
  const body = show("requestBody") ? operation.requestBody : undefined;
  const toParameter = async (parameter: ApiParameter, id: string): Promise<FieldView> => {
    const field = await builder.toField(
      parameter.name,
      parameter.required,
      parameter.schema ?? {},
      id,
      [],
      0
    );
    const description = await toHTML(parameter.description, highlight);

    return {
      ...field,
      deprecated: field.deprecated || parameter.deprecated,
      description: description ?? field.description
    };
  };
  const parameters = await Promise.all(
    (show("parameters") ? locations : [])
      .map(([location, label]) => {
        return {
          location,
          label,
          items: operation.parameters.filter((parameter) => parameter.in === location)
        };
      })
      .filter((group) => group.items.length)
      .map(async ({ location, label, items }): Promise<ParameterGroupView> => {
        const id = `${anchor}${location}`;
        const fields = await Promise.all(
          items.map((parameter) => toParameter(parameter, `${id}-${toID(parameter.name)}`))
        );

        return { id, label, fields };
      })
  );
  const responses = await Promise.all(
    (show("responses") ? operation.responses : []).map(async (response): Promise<ResponseView> => {
      const id = `${anchor}response-${toID(response.status)}`;
      const label = toStatusLabel(response.status);
      // Descriptions such as "OK" or "400" repeat the response header.
      const isRepeated = [response.status, label].some((text) => {
        return toPlainText(text) === toPlainText(response.description);
      });

      return {
        id,
        status: response.status,
        label,
        description: isRepeated ? undefined : await toHTML(response.description, highlight),
        headers: await Promise.all(
          response.headers.map(async (header) => {
            const field = await builder.toField(
              header.name,
              header.required,
              header.schema ?? {},
              `${id}-header-${toID(header.name)}`,
              [],
              0
            );
            const description = await toHTML(header.description, highlight);

            return { ...field, description: description ?? field.description };
          })
        ),
        contents: await Promise.all(
          response.contents.map((media, index) => {
            return builder.toMedia(media, index ? `${id}-${index + 1}` : `${id}-body`);
          })
        )
      };
    })
  );
  const examples = await Promise.all(
    (show("examples") ? createCodeExamples(operation, model) : []).map((example) => {
      return toCodeView(example.label, example.language, example.code, highlight);
    })
  );
  const responseExamples = await Promise.all(
    (show("examples") ? operation.responses : []).map((response) => {
      return toResponseExample(response.contents[0], response.status, model, highlight);
    })
  );

  return {
    anchor,
    embedded: options.anchor !== undefined,
    title: options.title,
    href: options.href,
    method: operation.method,
    path: operation.path,
    deprecated: operation.deprecated,
    description: show("description") ? await toHTML(operation.description, highlight) : undefined,
    servers: await Promise.all(
      operation.servers.map(async (server) => {
        return { url: server.url, description: await toHTML(server.description, highlight) };
      })
    ),
    security: await Promise.all(
      (show("authentication") ? operation.security : []).map((requirement) => {
        return Promise.all(
          Object.entries(requirement).map(async ([id, scopes]) => {
            const scheme = model.securitySchemes.find((item) => item.id === id);

            return {
              id,
              label: scheme ? toSchemeLabel(scheme) : id,
              description: await toHTML(scheme?.description, highlight),
              scopes
            };
          })
        );
      })
    ),
    parameters,
    requestBody: body && {
      id: `${anchor}request-body`,
      required: body.required,
      description: await toHTML(body.description, highlight),
      contents: await Promise.all(
        body.contents.map((media, index) => {
          return builder.toMedia(media, index ? `${anchor}body-${index + 1}` : `${anchor}body`);
        })
      )
    },
    responses,
    examples,
    responseExamples: responseExamples.filter((example): example is CodeView => Boolean(example))
  };
};

export { createOperationView, toID };
export type {
  OperationView,
  ServerView,
  SecuritySchemeView,
  ParameterGroupView,
  RequestBodyView,
  ResponseView,
  MediaView,
  FieldView,
  VariantView,
  CodeView,
  OperationParts,
  ViewOptions
};
