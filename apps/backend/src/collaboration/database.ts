import { Database } from "@hocuspocus/extension-database";
import { fetchEntryDocument, storeEntryDocument } from "./entry-database";
import { fetchSchemaDocument, storeSchemaDocument } from "./schema-database";

const collaborationDatabase = new Database({
  async fetch({ context, documentName }) {
    if (documentName.startsWith("sch_")) {
      return fetchSchemaDocument({
        documentName,
        workspaceID: context.workspaceID
      });
    }

    return fetchEntryDocument({ documentName, context });
  },
  async store({ documentName, lastContext, state }) {
    if (documentName.startsWith("sch_")) {
      return storeSchemaDocument({
        documentName,
        state,
        workspaceID: lastContext.workspaceID
      });
    }

    return storeEntryDocument({ documentName, lastContext, state });
  }
});

export { collaborationDatabase };
