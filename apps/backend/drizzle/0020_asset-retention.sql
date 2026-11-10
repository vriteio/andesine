ALTER TABLE "assets" ADD COLUMN "unreferenced_at" timestamp with time zone;
--> statement-breakpoint
-- Backfill development versions before enabling completed-image cleanup. Only existing
-- entry grants or upload provenance can authorize a historical image; ownership is insufficient.
DO $$
DECLARE
  image_reference record;
  encoded_id text;
  alphabet constant text := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  numeric_id numeric;
  hex_id text;
  decoded_asset_id uuid;
  digit integer;
BEGIN
  FOR image_reference IN
    SELECT DISTINCT v.workspace_id, v.entry_id, v.id AS version_id,
      image_id #>> '{}' AS public_id
    FROM entry_versions v,
      LATERAL jsonb_path_query(v.document, 'lax $.** ? (@.type == "image").attrs.assetID') image_id
    WHERE jsonb_typeof(image_id) = 'string'
  LOOP
    IF image_reference.public_id !~ '^ast_[A-Za-z0-9]{1,22}$' THEN
      RAISE EXCEPTION 'Invalid image ID in version %; repair it before migration', image_reference.version_id;
    END IF;
    encoded_id := substring(image_reference.public_id FROM 5);
    numeric_id := 0;
    FOR digit IN 1..length(encoded_id) LOOP
      numeric_id := numeric_id * 62 + strpos(alphabet, substring(encoded_id FROM digit FOR 1)) - 1;
    END LOOP;
    hex_id := '';
    FOR digit IN 1..32 LOOP
      hex_id := substring('0123456789abcdef' FROM mod(numeric_id, 16)::integer + 1 FOR 1) || hex_id;
      numeric_id := div(numeric_id, 16);
    END LOOP;
    IF numeric_id <> 0 THEN RAISE EXCEPTION 'Image ID exceeds UUID size'; END IF;
    decoded_asset_id := hex_id::uuid;

    INSERT INTO entry_version_assets (workspace_id, entry_id, version_id, asset_id)
    SELECT a.workspace_id, image_reference.entry_id, image_reference.version_id, a.id
    FROM assets a
    WHERE a.id = decoded_asset_id AND a.workspace_id = image_reference.workspace_id AND a.status = 'ready'
      AND (EXISTS (SELECT 1 FROM entry_assets e WHERE e.asset_id = a.id AND e.entry_id = image_reference.entry_id)
        OR EXISTS (SELECT 1 FROM asset_uploads u WHERE u.asset_id = a.id AND u.entry_id = image_reference.entry_id)
        OR EXISTS (SELECT 1 FROM entry_version_assets v WHERE v.asset_id = a.id AND v.entry_id = image_reference.entry_id))
    ON CONFLICT DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM entry_version_assets v
      WHERE v.version_id = image_reference.version_id AND v.asset_id = decoded_asset_id) THEN
      RAISE EXCEPTION 'Cannot verify image access for version %; repair its image references before migration', image_reference.version_id;
    END IF;
  END LOOP;
END $$;
