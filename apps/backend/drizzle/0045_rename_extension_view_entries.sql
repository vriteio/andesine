-- A contribution names its view in `view`, a name of `defineViews`, in place of `entry`: element
-- views, block actions, panels, and pages.
CREATE FUNCTION pg_temp.rename_entry(item jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT CASE
    WHEN item ? 'entry' THEN (item - 'entry') || jsonb_build_object('view', item->'entry')
    ELSE item
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.rename_entries(items jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT CASE
    WHEN jsonb_typeof(items) = 'array' THEN (
      SELECT COALESCE(
        jsonb_agg(pg_temp.rename_entry(item.value) ORDER BY item.ordinality),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(items) WITH ORDINALITY AS item
    )
    ELSE items
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.to_version(version jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT jsonb_set(
    version,
    '{manifest}',
    (
      SELECT COALESCE(jsonb_object_agg(field.key, CASE
        WHEN field.key IN ('elementViews', 'blockActions', 'panels', 'pages')
          THEN pg_temp.rename_entries(field.value)
        ELSE field.value
      END), '{}'::jsonb)
      FROM jsonb_each(version->'manifest') AS field
    )
  )
$$;
--> statement-breakpoint
UPDATE "extension_development_versions" SET "manifest" = pg_temp.to_version("manifest");
--> statement-breakpoint
UPDATE "extension_registry_versions" SET "manifest" = pg_temp.to_version("manifest");
