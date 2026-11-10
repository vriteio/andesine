import {
  entryVersionProperties,
  type DatabaseTransaction as Database
} from "@andesine/server/database";
import type { ContentNode } from "@andesine/document";
import { getContentPropertyValues, normalizePropertyText } from "../content/properties";
import { and, eq } from "drizzle-orm";

interface VersionPropertyInput {
  workspaceID: string;
  versionID: string;
  document: ContentNode;
}
interface StoreVersionPropertiesInput extends VersionPropertyInput {
  database: Database;
}

type VersionPropertyRecord = typeof entryVersionProperties.$inferInsert;

const getVersionPropertyRecords = (input: VersionPropertyInput): VersionPropertyRecord[] => {
  return getContentPropertyValues(input.document).map((property) => ({
    workspaceID: input.workspaceID,
    versionID: input.versionID,
    key: property.key,
    kind:
      property.type === "checkbox"
        ? "boolean"
        : property.type === "number" || property.type === "date"
          ? property.type
          : "text",
    textValue: property.textValue?.map(normalizePropertyText) ?? null,
    numberValue: property.numberValue === 0 ? 0 : (property.numberValue ?? null),
    booleanValue: property.booleanValue ?? null,
    dateValue: property.dateValue ?? null
  }));
};
// Use the version-writing transaction. The caller must hold the workspace lock.
const storeVersionProperties = async (input: StoreVersionPropertiesInput): Promise<void> => {
  const records = getVersionPropertyRecords(input);

  await input.database
    .delete(entryVersionProperties)
    .where(
      and(
        eq(entryVersionProperties.workspaceID, input.workspaceID),
        eq(entryVersionProperties.versionID, input.versionID)
      )
    );

  for (let offset = 0; offset < records.length; offset += 500) {
    await input.database.insert(entryVersionProperties).values(records.slice(offset, offset + 500));
  }
};

export { getVersionPropertyRecords, storeVersionProperties };
export type { VersionPropertyInput, VersionPropertyRecord };
