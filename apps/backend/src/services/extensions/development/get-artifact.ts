import { toUUID } from "@andesine/contracts/primitives";
import { extensionDevelopmentVersions, extensions } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface GetArtifactInput {
  extensionID: string;
  sha256: string;
}

const contentTypes = {
  frontend: "text/javascript",
  styles: "text/css",
  icons: "text/css"
} as const;

/** URLs carry the digest, so browsers load artifacts without credentials, like registry ones. */
const getArtifact = async (input: GetArtifactInput): Promise<File> => {
  const [build] = await db
    .select({ version: extensionDevelopmentVersions })
    .from(extensionDevelopmentVersions)
    .innerJoin(extensions, eq(extensions.id, extensionDevelopmentVersions.extensionID))
    .where(
      and(
        eq(extensionDevelopmentVersions.extensionID, toUUID(input.extensionID)),
        eq(extensions.development, true),
        isNull(extensions.uninstalledAt)
      )
    );
  const artifacts = build?.version.manifest.artifacts ?? {};
  const name = (Object.keys(contentTypes) as Array<keyof typeof contentTypes>).find((key) => {
    return artifacts[key]?.sha256 === input.sha256;
  });
  const content = name && build.version[name];

  if (!name || !content) throw new ORPCError("NOT_FOUND", { message: "Artifact not found" });

  return new File([content], `${name}.${name === "frontend" ? "js" : "css"}`, {
    type: contentTypes[name]
  });
};

export { getArtifact };
