import { collectionSchemas, entries } from "@andesine/server/database";
import { schemaDraftDocumentSchema } from "@andesine/document/tiptap";
import { serializeContentDocument } from "@andesine/server/content";
import {
  createSchemaDefinitionFromEditorDocument,
  createSchemaEditorDocument,
  hashSchemaDefinition
} from "@andesine/server/schema";
import type { ContentNode } from "@andesine/document";
import { db } from "#backend/lib/adapters";
import { toUUID } from "@andesine/contracts/primitives";
import { type SchemaDefinition } from "@andesine/contracts/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  createContentState,
  getContentSnapshot,
  setDocumentTitle,
  updateContentDocument,
  writeContentDocument
} from "./document";
import { prepareSchemaMigrationDocuments } from "./schema-content";
import { collaborationRedis } from "./redis";
import { collab } from "./server";
import type { ContentSnapshot } from "./types";
import { getWebhookActor, type WebhookOperation } from "@andesine/server/webhooks/recording";

interface OpenDocumentContentConnectionOptions {
  contributorID?: string;
  includeDeleted?: boolean;
  preserveSchemaRevision?: boolean;
}
interface UpdateDocumentContentOptions {
  expectedHash: string;
  webhookOperationID: string;
  /** Writes the content even when the editor schema rejects it. */
  restore?: boolean;
}
interface UpdateDocumentContentResult {
  applied: boolean;
  snapshot: ContentSnapshot;
}
interface UpdateSchemaDraftDocumentOptions {
  contributorID?: string;
  expectedHash?: string;
}

type ContentConnection = Awaited<ReturnType<typeof collab.openDirectConnection>>;

const prepareSchemaMigrationConnections = async (
  collectionIDs: string[],
  entryIDs: string[] = []
): Promise<void> => {
  await prepareSchemaMigrationDocuments(collab, collectionIDs, entryIDs);
};
const assertDocumentWorkspace = async (
  documentName: string,
  workspaceID: string,
  options: OpenDocumentContentConnectionOptions = {}
): Promise<void> => {
  const [entry] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.id, toUUID(documentName)),
        eq(entries.workspaceID, toUUID(workspaceID)),
        options.includeDeleted ? undefined : isNull(entries.deletedAt)
      )
    );

  if (!entry) throw new ORPCError("NOT_FOUND", { message: "Entry not found" });
};
const openDocumentContentConnection = async (
  documentName: string,
  workspaceID: string,
  options: OpenDocumentContentConnectionOptions = {}
): Promise<ContentConnection> => {
  await assertDocumentWorkspace(documentName, workspaceID, options);

  return collab.openDirectConnection(documentName, {
    workspaceID,
    contributorID: options.contributorID,
    includeDeleted: options.includeDeleted,
    preserveSchemaRevision: options.preserveSchemaRevision
  });
};
const updateDocumentTitle = async (
  documentName: string,
  title: string,
  workspaceID: string,
  contributorID?: string,
  webhookOperation?: WebhookOperation
): Promise<string> => {
  // Runs after the service call, so the actor comes from its operation.
  const connection = await collab.openDirectConnection(documentName, {
    contributorID,
    webhookOperationID: webhookOperation?.id,
    webhookActor: webhookOperation?.actor ?? null,
    workspaceID
  });
  let hash: string | undefined;

  try {
    await connection.transact((document) => {
      setDocumentTitle(document, title);
      hash = getContentSnapshot(document).hash;
    });
  } finally {
    await connection.disconnect();
  }

  if (!hash) throw new Error("Failed to update collaboration document");

  return hash;
};
const readDocumentContent = async (connection: ContentConnection): Promise<ContentSnapshot> => {
  let snapshot: ContentSnapshot | undefined;

  await connection.transact((document) => {
    snapshot = getContentSnapshot(document);
  });

  if (!snapshot) throw new Error("Failed to read collaboration document");

  return snapshot;
};
/** The content of a document that is open in this instance, without loading it. */
const getLoadedDocumentContent = (documentName: string): ContentSnapshot | null => {
  const document = collab.documents.get(documentName);

  return document ? getContentSnapshot(document) : null;
};
/** The content of a document open on any instance with its unsaved edits, or null if it's closed. */
const getOpenDocumentContent = async (
  documentName: string,
  workspaceID: string
): Promise<ContentSnapshot | null> => {
  const loaded = getLoadedDocumentContent(documentName);

  if (loaded) return loaded;

  if (!(await collaborationRedis.isDocumentOpen(documentName))) return null;

  try {
    const connection = await openDocumentContentConnection(documentName, workspaceID);
    const document = connection.document!;

    try {
      return await readDocumentContent(connection);
    } finally {
      // A read changes nothing, so skip the disconnect's save, which could replace a pending
      // one, and don't wait for the Redis extension's unload delay.
      document.removeDirectConnection();
      connection.document = null;
      collab.unloadDocument(document).catch((error: unknown) => {
        console.error("Failed to unload a collaboration document after a read", { error });
      });
    }
  } catch (error) {
    // Callers fall back to the stored content, as when the document is closed.
    console.error("Failed to read a document open on another instance", { error });
    return null;
  }
};
const getCurrentDocumentContent = async (
  documentName: string,
  workspaceID: string
): Promise<ContentSnapshot> => {
  const connection = await openDocumentContentConnection(documentName, workspaceID);

  try {
    return await readDocumentContent(connection);
  } finally {
    await connection.disconnect();
  }
};
/** Applies the content as a diff only when the current hash matches; else returns the current. */
const updateDocumentContent = async (
  connection: ContentConnection,
  content: ContentNode,
  options: UpdateDocumentContentOptions
): Promise<UpdateDocumentContentResult> => {
  let result: UpdateDocumentContentResult | undefined;

  await connection.transact((document) => {
    const current = getContentSnapshot(document);

    if (current.hash !== options.expectedHash) {
      result = { applied: false, snapshot: current };
      return;
    }

    connection.context.webhookOperationID = options.webhookOperationID;
    connection.context.webhookActor = getWebhookActor();
    (options.restore ? writeContentDocument : updateContentDocument)(document, content);
    result = { applied: true, snapshot: getContentSnapshot(document) };
  });

  if (!result) throw new Error("Failed to update collaboration document");

  return result;
};
const setPersistedDocumentSchemaRevision = (
  connection: ContentConnection,
  schemaRevisionID: string | null
): void => {
  connection.context.persistedSchemaRevisionID = schemaRevisionID;
};
const getCurrentSchemaDefinition = async (
  documentName: string,
  workspaceID: string
): Promise<SchemaDefinition> => {
  const [schema] = await db
    .select({ id: collectionSchemas.id })
    .from(collectionSchemas)
    .where(
      and(
        eq(collectionSchemas.id, toUUID(documentName)),
        eq(collectionSchemas.workspaceID, toUUID(workspaceID)),
        eq(collectionSchemas.enabled, true)
      )
    );

  if (!schema) throw new ORPCError("NOT_FOUND", { message: "Schema not found" });

  const connection = await collab.openDirectConnection(documentName, { workspaceID });
  let definition: SchemaDefinition | undefined;

  try {
    await connection.transact((document) => {
      definition = createSchemaDefinitionFromEditorDocument(serializeContentDocument(document));
    });
  } finally {
    await connection.disconnect();
  }

  if (!definition) throw new Error("Failed to read schema collaboration document");

  return definition;
};
/** Rejects definitions the editor can't load, e.g. with an unknown mark in initial content. */
const assertSchemaDraftDocument = (definition: SchemaDefinition): void => {
  try {
    createContentState(createSchemaEditorDocument(definition));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;

    throw new ORPCError("BAD_REQUEST", {
      message: "Schema initial content is invalid",
      data: {
        hints: [`Use only blocks and marks that the editor supports. Details: ${error.message}`]
      }
    });
  }
};
/** Replaces the draft's own fields in the live document; returns the hash it had before. */
const updateSchemaDraftDocument = async (
  documentName: string,
  workspaceID: string,
  definition: SchemaDefinition,
  options: UpdateSchemaDraftDocumentOptions
): Promise<string> => {
  const connection = await collab.openDirectConnection(documentName, {
    workspaceID,
    contributorID: options.contributorID
  });
  let hash: string | undefined;

  try {
    await connection.transact((document) => {
      const current = serializeContentDocument(document);

      hash = hashSchemaDefinition(createSchemaDefinitionFromEditorDocument(current));

      if (options.expectedHash !== undefined && options.expectedHash !== hash) return;

      const inheritedFields = (current.content || []).filter((node) => node.attrs?.inherited);
      const draft = createSchemaEditorDocument(definition);

      updateContentDocument(
        document,
        { ...draft, content: [...inheritedFields, ...(draft.content || [])] },
        schemaDraftDocumentSchema
      );
    });
  } finally {
    await connection.disconnect();
  }

  if (!hash) throw new Error("Failed to update schema collaboration document");

  return hash;
};

export {
  assertSchemaDraftDocument,
  getCurrentDocumentContent,
  getOpenDocumentContent,
  getCurrentSchemaDefinition,
  openDocumentContentConnection,
  prepareSchemaMigrationConnections,
  readDocumentContent,
  setPersistedDocumentSchemaRevision,
  updateDocumentContent,
  updateDocumentTitle,
  updateSchemaDraftDocument
};
export type { ContentConnection, OpenDocumentContentConnectionOptions };
