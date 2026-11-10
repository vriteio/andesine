-- Element props and settings are ordered field arrays: a view's or child's `propsSchema` (a JSON
-- Schema object or an array) becomes `props`, replacing the old `props` values, and an object
-- `configuration` becomes an array whose fields mark `required`. Arrays stay as they are.
CREATE FUNCTION pg_temp.to_fields(schema jsonb, with_required boolean) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT CASE
    WHEN jsonb_typeof(schema) = 'array' THEN schema
    WHEN jsonb_typeof(schema) = 'object' THEN COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('name', field.key) || field.value
            || CASE
              WHEN with_required AND COALESCE(schema->'required', '[]'::jsonb) ? field.key
                THEN '{"required": true}'::jsonb
              ELSE '{}'::jsonb
            END
        )
        FROM jsonb_each(schema->'properties') AS field
      ),
      '[]'::jsonb
    )
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.to_element(element jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT CASE
    WHEN element ? 'propsSchema' THEN (element - 'propsSchema' - 'props')
      || jsonb_build_object('props', pg_temp.to_fields(element->'propsSchema', false))
    WHEN jsonb_typeof(element->'props') = 'object' THEN element - 'props'
    ELSE element
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.to_view(view jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT pg_temp.to_element(view) || CASE
    WHEN jsonb_typeof(view->'children') = 'array' THEN jsonb_build_object(
      'children',
      (
        SELECT COALESCE(
          jsonb_agg(pg_temp.to_element(child.value) ORDER BY child.ordinality),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(view->'children') WITH ORDINALITY AS child
      )
    )
    ELSE '{}'::jsonb
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.to_version(version jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT jsonb_set(
    version,
    '{manifest}',
    (version->'manifest')
      || CASE
        WHEN jsonb_typeof(version->'manifest'->'elementViews') = 'array' THEN jsonb_build_object(
          'elementViews',
          (
            SELECT COALESCE(
              jsonb_agg(pg_temp.to_view(view.value) ORDER BY view.ordinality),
              '[]'::jsonb
            )
            FROM jsonb_array_elements(version->'manifest'->'elementViews') WITH ORDINALITY AS view
          )
        )
        ELSE '{}'::jsonb
      END
      || CASE
        WHEN jsonb_typeof(version->'manifest'->'configuration') = 'object' THEN jsonb_build_object(
          'configuration',
          pg_temp.to_fields(version->'manifest'->'configuration', true)
        )
        ELSE '{}'::jsonb
      END
  )
$$;
--> statement-breakpoint
UPDATE "extension_development_versions" SET "manifest" = pg_temp.to_version("manifest");
--> statement-breakpoint
UPDATE "extension_registry_versions" SET "manifest" = pg_temp.to_version("manifest");
