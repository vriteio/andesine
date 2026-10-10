import { hashContentDocument, replaceContentDocument } from "@andesine/server/content";
import type { ContentNode } from "@andesine/document";
import { getContentSnapshot } from "./document";
import { setPersistedDocumentSchemaRevision, type ContentConnection } from "./operations";
import type { ContentSnapshot } from "./types";
import { getWebhookOrigin } from "@andesine/server/webhooks/recording";

interface DeferredDocumentReplacements {
  prepare: (
    connection: ContentConnection,
    content: ContentNode,
    options: DocumentReplacementOptions
  ) => Promise<ContentSnapshot>;
  apply: () => Promise<void>;
}
interface DocumentReplacementOptions {
  schemaRevisionID?: string | null;
  preserve: (snapshot: ContentSnapshot) => Promise<void>;
}
interface DocumentReplacement extends DocumentReplacementOptions {
  connection: ContentConnection;
  content: ContentNode;
  previousHash: string;
}

// Preparation only reads the live documents. Apply after the caller's DB transaction
// commits, so a rejected transaction cannot publish or save an intermediate revert.
const createDeferredDocumentReplacements = (
  webhookOperationID: string
): DeferredDocumentReplacements => {
  const replacements: DocumentReplacement[] = [];
  // Captured now: the replacements apply after the caller's transaction commits.
  const webhookOriginExtensionID = getWebhookOrigin();

  let applied = false;

  const prepare: DeferredDocumentReplacements["prepare"] = async (connection, content, options) => {
    let previous: ContentSnapshot | undefined;

    if (applied) throw new Error("Document replacements have already been applied");

    await connection.transact((document) => {
      previous = getContentSnapshot(document);
    });

    if (!previous) throw new Error("Failed to read collaboration document");

    replacements.push({ connection, content, previousHash: previous.hash, ...options });

    return previous;
  };
  const apply = async (): Promise<void> => {
    if (applied) throw new Error("Document replacements have already been applied");

    applied = true;

    for (const replacement of replacements) {
      const { connection, content, schemaRevisionID, preserve } = replacement;
      const hash = hashContentDocument(content);

      let previousHash = replacement.previousHash;

      while (true) {
        let concurrentSnapshot: ContentSnapshot | undefined;

        await connection.transact((document) => {
          const current = getContentSnapshot(document);

          if (current.hash !== previousHash) {
            concurrentSnapshot = current;
            return;
          }

          if (schemaRevisionID !== undefined) {
            setPersistedDocumentSchemaRevision(connection, schemaRevisionID);
          }

          if (current.hash === hash) return;

          // Check and replace synchronously, after the current snapshot is durable.
          connection.context.webhookOperationID = webhookOperationID;
          connection.context.webhookOriginExtensionID = webhookOriginExtensionID;
          replaceContentDocument(document, content);
        });

        if (!concurrentSnapshot) break;

        await preserve(concurrentSnapshot);
        previousHash = concurrentSnapshot.hash;
      }
    }
  };

  return { prepare, apply };
};

export { createDeferredDocumentReplacements };
export type { DeferredDocumentReplacements };
