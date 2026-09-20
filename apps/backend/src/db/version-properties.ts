import type { PropertyFilter } from "#backend/lib/content/properties";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  uuid
} from "drizzle-orm/pg-core";
import { entryVersions } from "./versions";

const entryVersionProperties = pgTable(
  "entry_version_properties",
  {
    workspaceID: uuid("workspace_id").notNull(),
    versionID: uuid("version_id").notNull(),
    key: text("key").notNull(),
    kind: text("kind").$type<PropertyFilter["kind"]>().notNull(),
    textValue: text("text_value").array(),
    numberValue: doublePrecision("number_value"),
    booleanValue: boolean("boolean_value"),
    dateValue: bigint("date_value", { mode: "number" })
  },
  (table) => [
    primaryKey({ columns: [table.workspaceID, table.versionID, table.key] }),
    foreignKey({
      name: "entry_version_properties_workspace_version_fk",
      columns: [table.workspaceID, table.versionID],
      foreignColumns: [entryVersions.workspaceID, entryVersions.id]
    }).onDelete("cascade"),
    check(
      "entry_version_properties_value_kind_check",
      sql`
    (${table.kind} = 'text' AND ${table.textValue} IS NOT NULL AND ${table.numberValue} IS NULL AND ${table.booleanValue} IS NULL AND ${table.dateValue} IS NULL) OR
    (${table.kind} = 'number' AND ${table.textValue} IS NULL AND ${table.booleanValue} IS NULL AND ${table.dateValue} IS NULL) OR
    (${table.kind} = 'boolean' AND ${table.booleanValue} IS NOT NULL AND ${table.textValue} IS NULL AND ${table.numberValue} IS NULL AND ${table.dateValue} IS NULL) OR
    (${table.kind} = 'date' AND ${table.textValue} IS NULL AND ${table.numberValue} IS NULL AND ${table.booleanValue} IS NULL)
  `
    ),
    check(
      "entry_version_properties_finite_number_check",
      sql`${table.numberValue} > '-Infinity'::float8 AND ${table.numberValue} < 'Infinity'::float8`
    ),
    index("entry_version_properties_lookup_idx").on(
      table.workspaceID,
      table.key,
      table.kind,
      table.versionID
    ),
    index("entry_version_properties_number_idx")
      .on(table.workspaceID, table.key, table.numberValue, table.versionID)
      .where(sql`${table.kind} = 'number' AND ${table.numberValue} IS NOT NULL`),
    index("entry_version_properties_boolean_idx")
      .on(table.workspaceID, table.key, table.booleanValue, table.versionID)
      .where(sql`${table.kind} = 'boolean'`),
    index("entry_version_properties_date_idx")
      .on(table.workspaceID, table.key, table.dateValue, table.versionID)
      .where(sql`${table.kind} = 'date' AND ${table.dateValue} IS NOT NULL`)
  ]
);

export { entryVersionProperties };
