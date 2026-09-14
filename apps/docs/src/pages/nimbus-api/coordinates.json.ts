/**
 * `/nimbus-api/coordinates.json` — this site's published coordinate manifest,
 * fetched by other sites that cite its APIs via `apiReferences[]`.
 */

import { getCoordinatesManifest } from "@cloudflare/nimbus-docs/runtime";

export const prerender = true;

export async function GET() {
  const manifest = await getCoordinatesManifest();
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Adapter-dependent for static output; set CDN cache policy at the host.
      "Cache-Control": "public, max-age=3600"
    }
  });
}
