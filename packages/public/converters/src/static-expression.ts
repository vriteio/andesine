import { parseExpressionAt } from "acorn";
import { ConversionError } from "./utils";

interface Expression {
  type: string;
  end: number;
  value?: unknown;
  name?: string;
  regex?: unknown;
  bigint?: unknown;
  elements?: Array<Expression | null>;
  properties?: Expression[];
  key?: Expression;
  computed?: boolean;
  method?: boolean;
  shorthand?: boolean;
  kind?: string;
  operator?: string;
  argument?: Expression;
}

const staticExpression = (source: string): unknown => {
  const expression = parseExpressionAt(source, 0, { ecmaVersion: "latest" }) as Expression;
  const read = (node: Expression): unknown => {
    if (node.type === "Literal" && !node.regex && !node.bigint) return node.value;
    if (node.type === "ArrayExpression")
      return node.elements!.map((item) => {
        if (!item) throw new ConversionError("Array holes are not static JSON values");

        return read(item);
      });
    if (node.type === "ObjectExpression")
      return Object.fromEntries(
        node.properties!.map((property) => {
          if (
            property.type !== "Property" ||
            property.computed ||
            property.method ||
            property.shorthand ||
            property.kind !== "init"
          ) {
            throw new ConversionError("Only static object properties are supported");
          }
          const key = property.key!;

          return [
            key.type === "Identifier" ? key.name : String(key.value),
            read(property.value as Expression)
          ];
        })
      );
    if (node.type === "UnaryExpression" && ["-", "+"].includes(node.operator || "")) {
      const value = read(node.argument!);

      if (typeof value === "number") return node.operator === "-" ? -value : value;
    }
    throw new ConversionError(`Unsupported dynamic expression: ${node.type}`);
  };

  if (source.slice(expression.end).trim())
    throw new ConversionError("Unexpected content after static expression");

  return read(expression);
};

export { staticExpression };
