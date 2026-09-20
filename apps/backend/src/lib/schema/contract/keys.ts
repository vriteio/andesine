import { getContentFieldKey } from "#backend/lib/content/blocks";
import type { SchemaField } from "./definition";

interface SchemaFieldKeyConflict {
  key: string;
  kind: SchemaField["kind"];
  fieldIDs: string[];
}

const getSchemaFieldKeyConflicts = (fields: Array<SchemaField>): SchemaFieldKeyConflict[] => {
  const namespaces = {
    fragment: new Map<string, string[]>(),
    property: new Map<string, string[]>()
  };
  const conflicts: SchemaFieldKeyConflict[] = [];

  for (const field of fields) {
    const key = getContentFieldKey(field.kind, field.label);
    const fieldIDs = namespaces[field.kind].get(key) || [];

    fieldIDs.push(field.id);
    namespaces[field.kind].set(key, fieldIDs);
  }

  for (const kind of ["fragment", "property"] as const) {
    for (const [key, fieldIDs] of namespaces[kind]) {
      if (fieldIDs.length > 1) conflicts.push({ key, kind, fieldIDs });
    }
  }

  return conflicts;
};

export { getSchemaFieldKeyConflicts };
export type { SchemaFieldKeyConflict };
