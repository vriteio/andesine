import {
  getPreparedLlmsArtifact,
  getPreparedLlmsStaticPaths,
  type PreparedLlmsReference
} from "@cloudflare/nimbus-docs/build";

export const prerender = true;

interface SectionProps {
  artifact: PreparedLlmsReference;
}

export const getStaticPaths = () => getPreparedLlmsStaticPaths();

export async function GET({ props }: { props: SectionProps }) {
  const artifact = await getPreparedLlmsArtifact(props.artifact);
  return new Response(artifact.body, {
    headers: { "Content-Type": artifact.mediaType }
  });
}
