-- Schema fields hold an `initialValue` or `initialContent`, copied in when a field is added: not a
-- fallback for absent fields, as `default*` suggested.
CREATE FUNCTION pg_temp.rename_field(field jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT CASE
    WHEN field ? 'defaultValue'
      THEN (field - 'defaultValue') || jsonb_build_object('initialValue', field->'defaultValue')
    WHEN field ? 'defaultContent'
      THEN (field - 'defaultContent') || jsonb_build_object('initialContent', field->'defaultContent')
    ELSE field
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.rename_fields(definition jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT CASE
    WHEN jsonb_typeof(definition->'fields') = 'array' THEN jsonb_set(
      definition,
      '{fields}',
      (
        SELECT COALESCE(
          jsonb_agg(pg_temp.rename_field(field.value) ORDER BY field.ordinality),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(definition->'fields') WITH ORDINALITY AS field
      )
    )
    ELSE definition
  END
$$;
--> statement-breakpoint
UPDATE "collection_schemas" SET "draft_document" = pg_temp.rename_fields("draft_document")
WHERE "draft_document" IS NOT NULL;
--> statement-breakpoint
UPDATE "schema_versions" SET "definition" = pg_temp.rename_fields("definition");
--> statement-breakpoint
UPDATE "effective_schema_revisions" SET "definition" = pg_temp.rename_fields("definition");
