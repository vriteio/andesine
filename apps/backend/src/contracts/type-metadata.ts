import { baseContract } from "./base";
import { schemaMigrationErrors } from "./errors";
import {
  typeMetadataInputType,
  publishedTypeMetadataInputType,
  typeMetadataType
} from "./schemas/type-metadata";

const typeMetadataContract = baseContract.prefix("/type-metadata").router({
  getCurrent: baseContract
    .errors(schemaMigrationErrors)
    .route({
      method: "POST",
      path: "/current",
      summary: "Get current content type metadata",
      description:
        "Read-only bulk metadata for type generation. Returns one consistent database snapshot of accessible collections and their active effective schemas, including inheritance. Optional entry/tree data requires read:entries in addition to read:collections. Explicit unavailable collection selectors fail. Active schema migrations in the selected collections return a conflict. No entry content is loaded. Schema-free collections use general types without warnings.",
      tags: ["type-metadata"]
    })
    .meta({
      required: { session: true, key: ["read:collections"] },
      example: { collections: ["/Tutorials"], includeEntries: false }
    })
    .input(typeMetadataInputType)
    .output(typeMetadataType),
  getPublished: baseContract
    .route({
      method: "POST",
      path: "/published",
      summary: "Get published content type metadata",
      description:
        "Read-only bulk metadata for type generation. Resolves a channel once (published by default), or reads a retained snapshot. Uses publication paths, names, and exact entry-version schema revisions; never substitutes current schemas. Supports mixed revisions and schema-free entries. Empty collections use general types without warnings. Includes selected subtrees; no selectors means all published collections and root entries. Publication-access rules match content.get. No entry content is loaded. Reuse source.snapshotID for related reads. The fingerprint changes only when returned type metadata changes, not when content-only publication creates a new snapshot.",
      tags: ["type-metadata"]
    })
    .meta({
      required: { key: ["read:publishing"] },
      example: { channel: "published", collections: ["/Tutorials"] }
    })
    .input(publishedTypeMetadataInputType)
    .output(typeMetadataType)
});

export { typeMetadataContract };
