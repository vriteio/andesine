import {
  getPreparedMarkdownArtifact,
  getPreparedMarkdownStaticPaths,
  type PreparedMarkdownReference
} from "@cloudflare/nimbus-docs/build";

export const prerender = true;

interface SlugProps {
  artifact: PreparedMarkdownReference;
}

export const getStaticPaths = () =>
  getPreparedMarkdownStaticPaths({ collection: "docs", surface: "source" });

export async function GET({ props }: { props: SlugProps }) {
  const artifact = await getPreparedMarkdownArtifact(props.artifact);
  return new Response(artifact.body, {
    headers: { "Content-Type": artifact.mediaType }
  });
}
