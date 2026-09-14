import { getPreparedLlmsArtifact } from "@cloudflare/nimbus-docs/build";

export const prerender = true;

export async function GET() {
  const artifact = await getPreparedLlmsArtifact({
    scope: "site",
    surface: "index"
  });
  return new Response(artifact.body, {
    headers: { "Content-Type": artifact.mediaType }
  });
}
