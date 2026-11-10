import config, { highlight } from "virtual:andesine/config";
import { toOperationTitle } from "./labels";
import { createLinks } from "./load";
import type { ApiModel } from "./model";
import type { OpenAPILinks } from "./markdown";
import { loadOpenAPIModel } from "./stored";
import { createOperationView, toID, type OperationParts, type OperationView } from "./view";

interface OperationProps extends OperationParts {
  /** Set on reference pages. */
  view?: OperationView;
  /** The ID of an OpenAPI source, for embeds. */
  source?: string;
  /** The operation ID, or `METHOD /path` without one, for embeds. */
  id?: string;
  /** Prefix of element IDs; needed when a page embeds the same operation twice. */
  anchor?: string;
}

// Links by model, so a spec that loads again in development gets new links.
const links = new WeakMap<ApiModel, OpenAPILinks>();

/** The view of an `<Operation>`: the given view on reference pages, or an embedded operation. */
const getOperationView = async (props: OperationProps): Promise<OperationView> => {
  if (props.view) return props.view;

  const source = config.sources.find((item) => item.id === props.source);

  if (source?.type !== "openapi") {
    throw new Error(
      `<Operation>: "${props.source}" is not an OpenAPI source. Set \`source\` to its ID.`
    );
  }

  const model = await loadOpenAPIModel(source);
  const operation = model.operations.find((item) => item.id === props.id);

  if (!operation) {
    throw new Error(`<Operation>: "${props.id}" is not an operation of source "${source.id}".`);
  }

  if (!links.has(model)) links.set(model, createLinks(source, model, config.base).links);

  return createOperationView(operation, model, {
    highlight,
    title: toOperationTitle(operation),
    href: links.get(model)!.operations[operation.id]!,
    anchor: props.anchor ?? `${toID(source.id)}-${toID(operation.id)}-`,
    parts: {
      description: props.description,
      authentication: props.authentication,
      parameters: props.parameters,
      requestBody: props.requestBody,
      responses: props.responses,
      examples: props.examples
    }
  });
};

export { getOperationView };
export type { OperationProps };
