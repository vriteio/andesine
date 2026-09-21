/* eslint-disable max-lines */
// Generated from SDK openapi.json. Do not edit.
import type { APICommand, JSONSchema } from "./types";

const commands: APICommand[] = [
  {
    id: "assets.attach",
    group: "assets",
    command: "attach",
    method: "post",
    path: "/assets/{assetID}/attachments",
    summary: "Attach an asset",
    description:
      "Attaches a ready image to an entry. This does not insert an image node into the document.\n\nRequired API key permissions: entries. Write permissions also grant read access for the same resource.",
    example: {
      assetID: "ast_example",
      entryID: "ent_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "assetID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^ast_[A-Za-z\\d]{1,22}$"
        },
        flag: "asset-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "entryID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^ent_[A-Za-z\\d]{1,22}$"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "assets.get",
    group: "assets",
    command: "get",
    method: "get",
    path: "/assets/{assetID}",
    summary: "Get asset status and details",
    description:
      "Returns image metadata, processing status, and available files. Supply entryID when checking access through an entry.",
    example: {
      assetID: "ast_example",
      entryID: "ent_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "assetID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^ast_[A-Za-z\\d]{1,22}$"
        },
        flag: "asset-id",
        kind: "string",
        nullable: false
      },
      {
        name: "entryID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^ent_[A-Za-z\\d]{1,22}$"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "assets.importURL",
    group: "assets",
    command: "import-url",
    method: "post",
    path: "/assets/imports",
    summary: "Import an image URL",
    description:
      "Downloads a remote image and starts processing it for the entry. With checkDuplicates, can return an existing image instead. Use assets.get to check processing status.\n\nRequired API key permissions: entries. Write permissions also grant read access for the same resource.",
    example: {
      assetID: "ast_example",
      entryID: "ent_example",
      url: "https://example.com/image.png",
      checkDuplicates: true
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "assetID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^ast_[A-Za-z\\d]{1,22}$"
        },
        flag: "asset-id",
        kind: "string",
        nullable: false
      },
      {
        name: "entryID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^ent_[A-Za-z\\d]{1,22}$"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "url",
        location: "body",
        required: true,
        schema: {
          type: "string",
          maxLength: 4096,
          format: "uri"
        },
        flag: "url",
        kind: "string",
        nullable: false
      },
      {
        name: "checkDuplicates",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          default: false
        },
        flag: "check-duplicates",
        kind: "boolean",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "assets.register",
    group: "assets",
    command: "register",
    method: "post",
    path: "/assets/uploads",
    summary: "Register an image upload",
    description:
      "Reserves an image upload for an entry. Supply the byte count and lowercase SHA-256 checksum of the file. Call assets.upload before expiresAt, then use assets.get to check processing status.\n\nRequired API key permissions: entries. Write permissions also grant read access for the same resource.",
    example: {
      assetID: "ast_example",
      entryID: "ent_example",
      filename: "image.png",
      byteSize: 1024,
      checksum: "0000000000000000000000000000000000000000000000000000000000000000"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "assetID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^ast_[A-Za-z\\d]{1,22}$"
        },
        flag: "asset-id",
        kind: "string",
        nullable: false
      },
      {
        name: "entryID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^ent_[A-Za-z\\d]{1,22}$"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "filename",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 255
        },
        flag: "filename",
        kind: "string",
        nullable: false
      },
      {
        name: "byteSize",
        location: "body",
        required: true,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 10485760
        },
        flag: "byte-size",
        kind: "number",
        nullable: false
      },
      {
        name: "checksum",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^[a-f0-9]{64}$",
          description: "SHA-256 of the file bytes, verified by the backend and worker"
        },
        flag: "checksum",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "assets.search",
    group: "assets",
    command: "search",
    method: "get",
    path: "/assets/search",
    summary: "Search assets",
    description:
      "Finds workspace images by text or SHA-256 checksum. Semantic search defaults to true. Returns up to 50 results.\n\nRequired API key permissions: read:entries, read:collections. Write permissions also grant read access for the same resource.",
    example: {
      query: "mountains",
      limit: 10
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "query",
        location: "query",
        required: false,
        schema: {
          type: "string",
          maxLength: 500,
          default: ""
        },
        flag: "query",
        kind: "string",
        nullable: false
      },
      {
        name: "checksum",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^[a-f0-9]{64}$"
        },
        flag: "checksum",
        kind: "string",
        nullable: false
      },
      {
        name: "semantic",
        location: "query",
        required: false,
        schema: {
          type: "boolean",
          default: true
        },
        flag: "semantic",
        kind: "boolean",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          default: 24
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "assets.upload",
    group: "assets",
    command: "upload",
    method: "put",
    path: "/assets/{assetID}/upload",
    summary: "Upload registered image bytes",
    description:
      "Uploads a file for a registered asset with multipart/form-data. The bytes must match the registered size and checksum. Processing continues after the upload; use assets.get to check status.\n\nRequired API key permissions: entries. Write permissions also grant read access for the same resource.",
    example: {
      assetID: "ast_example",
      file: "<binary file>"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "assetID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^ast_[A-Za-z\\d]{1,22}$"
        },
        flag: "asset-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "file",
        location: "body",
        required: true,
        schema: {
          type: "string",
          contentMediaType: "*/*"
        },
        flag: "file",
        kind: "file",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "auth.getIdentity",
    group: "auth",
    command: "get-identity",
    method: "get",
    path: "/identity",
    summary: "Get credential identity",
    description:
      "Returns the authenticated user for OAuth or browser credentials, or the key and workspace IDs for an API key. Does not require a workspace selection and does not count toward API usage.",
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [],
    conditional: false,
    response: "json"
  },
  {
    id: "collections.bulkDelete",
    group: "collections",
    command: "bulk-delete",
    method: "post",
    path: "/collections/bulk/delete",
    summary: "Delete collection trees",
    description:
      "Soft-deletes the selected collections, their descendants, and their entries. The workspace root cannot be deleted. An active schema migration can block this action.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      ids: ["coll_example"]
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "ids",
        location: "body",
        required: true,
        schema: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "string",
            pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
          },
          description: "IDs of the collections to delete"
        },
        flag: "ids",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "collections.create",
    group: "collections",
    command: "create",
    method: "post",
    path: "/collections",
    summary: "Create a collection",
    description:
      "Creates a child collection. Without parentID, uses the workspace root. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed, NFC-normalized, case-sensitive, and shared by sibling entries and collections. Names cannot contain a slash or equal a single dot or two dots. Restricted collections require a session with restricted_collections permission and the Pro plan; API keys cannot create them.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      name: "Documentation",
      parentID: "coll_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "id",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the collection"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 300,
          description: "Name of the collection"
        },
        flag: "name",
        kind: "string",
        nullable: false
      },
      {
        name: "parentID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the parent collection,"
        },
        flag: "parent-id",
        kind: "string",
        nullable: false
      },
      {
        name: "restricted",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          description: "Whether to restrict access to the collection tree"
        },
        flag: "restricted",
        kind: "boolean",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "collections.delete",
    group: "collections",
    command: "delete",
    method: "delete",
    path: "/collections/{id}",
    summary: "Delete a collection tree",
    description:
      "Soft-deletes the collection, its descendants, and their entries. The workspace root cannot be deleted. An active schema migration can block this action.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      id: "coll_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the collection to delete"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "collections.list",
    group: "collections",
    command: "list",
    method: "get",
    path: "/collections/list",
    summary: "List collections",
    description:
      "Lists collections under the selected ancestor. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example",
      limit: 20
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum collections to return"
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "cursor"
  },
  {
    id: "collections.update",
    group: "collections",
    command: "update",
    method: "put",
    path: "/collections/{id}",
    summary: "Rename a collection",
    description:
      "Updates the collection name. Rejects names already used by a sibling entry or collection. An active schema migration can block this action.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      id: "coll_example",
      name: "Guides"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the collection to be updated"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 300,
          description: "New name of the collection"
        },
        flag: "name",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "content.get",
    group: "content",
    command: "get",
    method: "get",
    path: "/content/entries/get",
    summary: "Get published entry content",
    description:
      "Returns content from a publishing channel or a specific available snapshot. Use channel or snapshotID, never both. The default channel is published. Validates saved content against its recorded schema and returns schema metadata. expectedSchemaHash must match that revision; schema-less content cannot match it. Validation and hash checks run before ETag handling. Supports ETag and If-None-Match; a match returns 304 without a body.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      entryID: "ent_example",
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "entryID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^ent_[A-Za-z\\d]{1,22}$"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "path",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "path",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSchemaHash",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^[a-f\\d]{64}$",
          description: "Hash of the effective schema definition"
        },
        flag: "expected-schema-hash",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "query",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description: "Historical publication snapshot to read"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: true,
    response: "json"
  },
  {
    id: "content.getAsset",
    group: "content",
    command: "get-asset",
    method: "get",
    path: "/content/assets/{workspaceID}/{snapshotID}/{entryID}/{assetID}/{variant}",
    summary: "Download a published asset",
    description:
      "Returns binary image data from a publication snapshot. No API key is required. The asset must belong to the entry in that available snapshot. Use the asset URLs returned with published content.",
    example: {
      workspaceID: "ws_example",
      snapshotID: "snp_example",
      entryID: "ent_example",
      assetID: "ast_example",
      variant: "display"
    },
    security: [],
    fields: [
      {
        name: "workspaceID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^ws_[A-Za-z\\d]{1,22}$"
        },
        flag: "workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "entryID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "assetID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^ast_[A-Za-z\\d]{1,22}$"
        },
        flag: "asset-id",
        kind: "string",
        nullable: false
      },
      {
        name: "variant",
        location: "path",
        required: true,
        schema: {
          enum: ["thumbnail", "display"],
          type: "string"
        },
        flag: "variant",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "binary"
  },
  {
    id: "content.getSchema",
    group: "content",
    command: "get-schema",
    method: "get",
    path: "/content/entries/schema",
    summary: "Get a published entry schema",
    description:
      "Returns the exact recorded effective schema, or null for schema-less content. Uses the same publication access as content.get. Pass its snapshotID for a consistent read; use channel or snapshotID, not both.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      entryID: "ent_example",
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "entryID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^ent_[A-Za-z\\d]{1,22}$"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "path",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "path",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "query",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "content.getTree",
    group: "content",
    command: "get-tree",
    method: "get",
    path: "/content/tree",
    summary: "Get a published collection tree",
    description:
      "Returns a published collection tree and its snapshot ID. Use channel or snapshotID, never both. The default channel is published. Reuse the snapshot ID for consistent content reads. Supports ETag and If-None-Match; a match returns 304 without a body.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example",
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "query",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description: "Historical publication snapshot to read"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: true,
    response: "json"
  },
  {
    id: "content.listCollections",
    group: "content",
    command: "list-collections",
    method: "get",
    path: "/content/collections",
    summary: "List published collections",
    description:
      "Returns a flat page of collections from a publication snapshot. The default channel is published. On later pages, pass the returned snapshotID and pagination.nextCursor, and omit channel. Optionally select direct children using collectionID or collectionPath. Results are ordered by ID, not display order.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      channel: "published",
      limit: 20
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page; keep the same filters"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "collectionID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "query",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "snapshot"
  },
  {
    id: "content.listEntries",
    group: "content",
    command: "list-entries",
    method: "get",
    path: "/content/entries",
    summary: "List published entries",
    description:
      "Returns a flat page of entries from a publication snapshot. The default channel is published. On later pages, pass the returned snapshotID and pagination.nextCursor, and omit channel. Select direct children using collectionID or collectionPath, or include nested entries with descendants: true. descendants requires a collection scope. All property filters must match the assigned version. includeContent: true returns validated full content, properties, fragments, assets, and recorded schema metadata. An invalid full item fails the page. Keep the same scope and filters across pages. Results are ordered by ID, not display order.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      channel: "published",
      limit: 20
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page; keep the same filters"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "collectionID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "query",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "descendants",
        location: "query",
        required: false,
        schema: {
          type: "boolean",
          default: false
        },
        flag: "descendants",
        kind: "boolean",
        nullable: false
      },
      {
        name: "includeContent",
        location: "query",
        required: false,
        schema: {
          type: "boolean",
          default: false
        },
        flag: "include-content",
        kind: "boolean",
        nullable: false
      },
      {
        name: "filters",
        location: "query",
        required: false,
        schema: {
          type: "array",
          maxItems: 20,
          items: {
            $ref: "#/components/schemas/PropertyFilter"
          },
          default: []
        },
        flag: "filters",
        kind: "json",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "snapshot"
  },
  {
    id: "entries.bulkDelete",
    group: "entries",
    command: "bulk-delete",
    method: "post",
    path: "/entries/bulk/delete",
    summary: "Delete entries",
    description:
      "Soft-deletes the selected entries and clears current-entry selections for affected members. An active schema migration can block this action.\n\nRequired API key permissions: entries. Write permissions also grant read access for the same resource.",
    example: {
      ids: ["ent_example"]
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "ids",
        location: "body",
        required: true,
        schema: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "string",
            pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
          },
          description: "IDs of the entries to delete"
        },
        flag: "ids",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "entries.create",
    group: "entries",
    command: "create",
    method: "post",
    path: "/entries",
    summary: "Create an entry",
    description:
      "Creates an entry and its initial document. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed, NFC-normalized, case-sensitive, and shared by sibling entries and collections. Names cannot contain a slash or equal a single dot or two dots. A collection schema can set the initial content.\n\nRequired API key permissions: entries. Write permissions also grant read access for the same resource.",
    example: {
      name: "Getting started",
      collectionID: "coll_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "id",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the entry"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: false,
        schema: {
          type: "string",
          maxLength: 300,
          description: "Name of the entry"
        },
        flag: "name",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the collection this entry belongs to"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "entries.delete",
    group: "entries",
    command: "delete",
    method: "delete",
    path: "/entries/{id}",
    summary: "Delete an entry",
    description:
      "Soft-deletes the entry and clears current-entry selections for affected members. An active schema migration can block this action.\n\nRequired API key permissions: entries. Write permissions also grant read access for the same resource.",
    example: {
      id: "ent_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the entry to delete"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "entries.get",
    group: "entries",
    command: "get",
    method: "get",
    path: "/entries/get",
    summary: "Get an entry",
    description:
      "Returns current entry details, fragments, properties, and recorded schema metadata. Validates content without changing it. expectedSchemaHash must match the recorded schema; schema-less content cannot match it. Use content.get to read published content.\n\nRequired API key permissions: read:entries. Write permissions also grant read access for the same resource.",
    example: {
      id: "ent_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^ent_[A-Za-z\\d]{1,22}$"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "path",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "path",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSchemaHash",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^[a-f\\d]{64}$",
          description: "Hash of the effective schema definition"
        },
        flag: "expected-schema-hash",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "entries.list",
    group: "entries",
    command: "list",
    method: "get",
    path: "/entries/list",
    summary: "List entries",
    description:
      "Lists entries in the selected collection, or all accessible entries when collectionID is omitted. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100 and defaults to 50.\n\nRequired API key permissions: read:entries. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example",
      limit: 20
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum entries to return"
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "cursor"
  },
  {
    id: "entries.update",
    group: "entries",
    command: "update",
    method: "put",
    path: "/entries/{id}",
    summary: "Rename an entry",
    description:
      "Updates the entry name. Rejects names already used by a sibling entry or collection. An active schema migration can block this action.\n\nRequired API key permissions: entries. Write permissions also grant read access for the same resource.",
    example: {
      id: "ent_example",
      name: "Installation"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the entry to be updated"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: false,
        schema: {
          type: "string",
          maxLength: 300,
          description: "New name of the entry"
        },
        flag: "name",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "instance.get",
    group: "instance",
    command: "get",
    method: "get",
    path: "/instance",
    summary: "Get instance capabilities and limits",
    description:
      "Returns configured features and effective limits for the authenticated workspace. These values do not grant permissions or report live service health. No discovery request is made automatically by the SDK.",
    example: {},
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "memberships.invite",
    group: "memberships",
    command: "invite",
    method: "post",
    path: "/memberships",
    summary: "Invite a workspace member",
    description:
      "Creates an invitation and attempts email delivery. Check emailDelivery in the result. Requires the Pro plan and permission to delegate the selected role. Existing membership or pending invitation returns a conflict.\n\nRequired API key permissions: memberships. Write permissions also grant read access for the same resource.",
    example: {
      email: "editor@example.com",
      roleID: "rl_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "email",
        location: "body",
        required: true,
        schema: {
          type: "string",
          format: "email",
          description: "Email address of the user to invite"
        },
        flag: "email",
        kind: "string",
        nullable: false
      },
      {
        name: "roleID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the role to assign"
        },
        flag: "role-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "memberships.list",
    group: "memberships",
    command: "list",
    method: "get",
    path: "/memberships",
    summary: "List workspace members",
    description:
      "Lists workspace memberships with role and user details. Use pagination.nextCursor to continue with the same filters; concurrent changes can affect later pages.\n\nRequired API key permissions: read:memberships. Write permissions also grant read access for the same resource.",
    example: {},
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page; keep the same filters"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "cursor"
  },
  {
    id: "memberships.listInvites",
    group: "memberships",
    command: "list-invites",
    method: "get",
    path: "/memberships/invites",
    summary: "List invitations",
    description:
      "Lists pending, unexpired workspace invitations. Use pagination.nextCursor to continue. Requires the Pro plan.\n\nRequired API key permissions: memberships. Write permissions also grant read access for the same resource.",
    example: {},
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page; keep the same filters"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "cursor"
  },
  {
    id: "memberships.remove",
    group: "memberships",
    command: "remove",
    method: "delete",
    path: "/memberships/{id}",
    summary: "Remove a workspace member",
    description:
      "Removes the membership and its workspace access. Administrator memberships have additional restrictions.\n\nRequired API key permissions: memberships. Write permissions also grant read access for the same resource.",
    example: {
      id: "ms_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the membership to remove"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "memberships.resendInvite",
    group: "memberships",
    command: "resend-invite",
    method: "post",
    path: "/memberships/invites/{id}/resend",
    summary: "Resend an invitation",
    description:
      "Attempts email delivery again for a pending invitation. Check emailDelivery in the result. Requires the Pro plan.\n\nRequired API key permissions: memberships. Write permissions also grant read access for the same resource.",
    example: {
      id: "inv_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the pending invitation"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "memberships.revokeInvite",
    group: "memberships",
    command: "revoke-invite",
    method: "delete",
    path: "/memberships/invites/{id}",
    summary: "Revoke an invitation",
    description:
      "Revokes a pending invitation so it can no longer be accepted. Requires the Pro plan.\n\nRequired API key permissions: memberships. Write permissions also grant read access for the same resource.",
    example: {
      id: "inv_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the invite to revoke"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "memberships.update",
    group: "memberships",
    command: "update",
    method: "patch",
    path: "/memberships/{id}",
    summary: "Change a member role",
    description:
      "Assigns a new role to a member. Requires the Pro plan and permission to delegate that role. Administrator assignments have additional restrictions.\n\nRequired API key permissions: memberships. Write permissions also grant read access for the same resource.",
    example: {
      id: "ms_example",
      roleID: "rl_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the membership to update"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "roleID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "New role ID"
        },
        flag: "role-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "publishing.bulkPublishCollections",
    group: "publishing",
    command: "bulk-publish-collections",
    method: "post",
    path: "/publishing/collections/bulk/publish",
    summary: "Publish collection trees",
    description:
      "Publishes the latest entry versions in the selected publishing-enabled collection trees. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      ids: ["coll_example"],
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description:
            "Reject the mutation if the channel no longer points to this reviewed snapshot"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "ids",
        location: "body",
        required: true,
        schema: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "string",
            pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
          },
          description: "IDs of the collection trees to publish"
        },
        flag: "ids",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.bulkPublishEntries",
    group: "publishing",
    command: "bulk-publish-entries",
    method: "post",
    path: "/publishing/entries/bulk/publish",
    summary: "Publish entries",
    description:
      "Publishes the selected entries with optional version IDs. Entries must be in publishing-enabled collections. At least one entry is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      entries: [
        {
          entryID: "ent_example"
        }
      ],
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description:
            "Reject the mutation if the channel no longer points to this reviewed snapshot"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "entries",
        location: "body",
        required: true,
        schema: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            $ref: "#/components/schemas/PublishEntryTarget"
          },
          description: "Entries and versions to publish"
        },
        flag: "entries",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "publishing.bulkSetCollections",
    group: "publishing",
    command: "bulk-set-collections",
    method: "post",
    path: "/publishing/collections/bulk/set",
    summary: "Configure publishing for collections",
    description:
      "Enables publishing for the selected collections, or disables it and unpublishes their trees from all channels. When enabling, publish can also publish the latest entry versions.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      ids: ["coll_example"],
      enabled: true,
      publish: false
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "ids",
        location: "body",
        required: true,
        schema: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "string",
            pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
          },
          description: "IDs of the collections to configure"
        },
        flag: "ids",
        kind: "json",
        nullable: false
      },
      {
        name: "expectedSnapshots",
        location: "body",
        required: false,
        schema: {
          type: "object",
          propertyNames: {
            type: "string",
            minLength: 1,
            maxLength: 50
          },
          additionalProperties: {
            type: "string",
            pattern: "^snp_[A-Za-z\\d]{1,22}$"
          },
          description:
            "Optional snapshot checks for supplied channels before changing collection publishing. Omitted channels are not checked."
        },
        flag: "expected-snapshots",
        kind: "json",
        nullable: false
      },
      {
        name: "enabled",
        location: "body",
        required: true,
        schema: {
          type: "boolean",
          description:
            "Enable publishing, or disable and unpublish the collection trees from all channels"
        },
        flag: "enabled",
        kind: "boolean",
        nullable: false
      },
      {
        name: "publish",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          description: "Whether to publish latest entry versions when enabling publishing"
        },
        flag: "publish",
        kind: "boolean",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.bulkUnpublishCollections",
    group: "publishing",
    command: "bulk-unpublish-collections",
    method: "post",
    path: "/publishing/collections/bulk/unpublish",
    summary: "Unpublish collection trees",
    description:
      "Removes publication assignments for the selected collection trees from the channel. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      ids: ["coll_example"],
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description:
            "Reject the mutation if the channel no longer points to this reviewed snapshot"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "ids",
        location: "body",
        required: true,
        schema: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "string",
            pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
          },
          description: "IDs of the collection trees to unpublish"
        },
        flag: "ids",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.bulkUnpublishEntries",
    group: "publishing",
    command: "bulk-unpublish-entries",
    method: "post",
    path: "/publishing/entries/bulk/unpublish",
    summary: "Unpublish entries",
    description:
      "Removes publication assignments for the selected entries from the channel. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      ids: ["ent_example"],
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description:
            "Reject the mutation if the channel no longer points to this reviewed snapshot"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "ids",
        location: "body",
        required: true,
        schema: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "string",
            pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
          },
          description: "IDs of the entries to unpublish"
        },
        flag: "ids",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "publishing.createChannel",
    group: "publishing",
    command: "create-channel",
    method: "post",
    path: "/publishing/channels",
    summary: "Create a publishing channel",
    description:
      "Creates a publishing channel from its display name and returns the generated channel code.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      name: "Preview"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "Publishing channel label"
        },
        flag: "name",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.deleteChannel",
    group: "publishing",
    command: "delete-channel",
    method: "delete",
    path: "/publishing/channels/{code}",
    summary: "Delete a publishing channel",
    description:
      "Deletes a custom channel and its publication assignments. The default published channel cannot be deleted.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      code: "preview"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "code",
        location: "path",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "Publishing channel identifier"
        },
        flag: "code",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description: "Reject deletion if the channel snapshot changed"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "publishing.getChannelContent",
    group: "publishing",
    command: "get-channel-content",
    method: "get",
    path: "/publishing/channels/{channel}/content",
    summary: "Get channel content and pending changes",
    description:
      "Returns publication state and pending changes for a publishing root, with the snapshot ID needed to review and revert changes.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      channel: "published",
      collectionID: "coll_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "channel",
        location: "path",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionID",
        location: "query",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Publishing root collection whose content to list"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.getEntryVersion",
    group: "publishing",
    command: "get-entry-version",
    method: "get",
    path: "/publishing/entries/{entryID}/version",
    summary: "Get a published entry version",
    description:
      "Returns the entry version assigned to a channel, or to an explicit available snapshot, with its recorded schema metadata. Validates content against that revision. expectedSchemaHash must match it; schema-less content cannot match it. The default channel is published.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      entryID: "ent_example",
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "entryID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Entry whose published version to get"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "query",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSchemaHash",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^[a-f\\d]{64}$",
          description: "Hash of the effective schema definition"
        },
        flag: "expected-schema-hash",
        kind: "string",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description: "Exact publication snapshot to read"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.listChannels",
    group: "publishing",
    command: "list-channels",
    method: "get",
    path: "/publishing/channels",
    summary: "List publishing channels",
    description:
      "Returns workspace publishing channels. Set includeAssignmentCount to include entry assignment counts.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      includeAssignmentCount: true
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "includeAssignmentCount",
        location: "query",
        required: false,
        schema: {
          type: "boolean",
          description: "Whether to include the number of assigned entries"
        },
        flag: "include-assignment-count",
        kind: "boolean",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.listEntryPublications",
    group: "publishing",
    command: "list-entry-publications",
    method: "get",
    path: "/publishing/entries/{entryID}/publications",
    summary: "List entry publications",
    description:
      "Returns the entry publication assignments across channels.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      entryID: "ent_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "entryID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Entry whose publications to list"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.publishCollection",
    group: "publishing",
    command: "publish-collection",
    method: "post",
    path: "/publishing/collections/{collectionID}",
    summary: "Publish a collection tree",
    description:
      "Publishes the latest entry versions in a publishing-enabled collection tree to the channel. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example",
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Collection tree to publish"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description:
            "Reject the mutation if the channel no longer points to this reviewed snapshot"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.publishEntry",
    group: "publishing",
    command: "publish-entry",
    method: "post",
    path: "/publishing/entries/{entryID}",
    summary: "Publish an entry",
    description:
      "Publishes an existing version, or the latest entry content if versionID is omitted. The entry must be in a publishing-enabled collection. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      entryID: "ent_example",
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "entryID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Entry to publish"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description:
            "Reject the mutation if the channel no longer points to this reviewed snapshot"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "versionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Existing version to publish"
        },
        flag: "version-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "publishing.revertChanges",
    group: "publishing",
    command: "revert-changes",
    method: "post",
    path: "/publishing/changes/revert",
    summary: "Revert pending publishing changes",
    description:
      "Restores selected drafts to the reviewed publication snapshot. This can remove unpublished items and replace draft content. First review publishing.getChannelContent and pass its snapshotID. Use all: true or specific collectionIDs/entryIDs, never both. Requires write access to affected resources in addition to read:publishing.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example",
      snapshotID: "snp_example",
      entryIDs: ["ent_example"],
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "all",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          description: "Whether to revert all pending changes"
        },
        flag: "all",
        kind: "boolean",
        nullable: false
      },
      {
        name: "collectionID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Publishing root collection"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionIDs",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 100,
          items: {
            type: "string",
            pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
          },
          description: "Collections whose changes to revert"
        },
        flag: "collection-ids",
        kind: "json",
        nullable: false
      },
      {
        name: "entryIDs",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 100,
          items: {
            type: "string",
            pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
          },
          description: "Entries whose changes to revert"
        },
        flag: "entry-ids",
        kind: "json",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "body",
        required: true,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description: "Snapshot used to review the changes"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.setCollection",
    group: "publishing",
    command: "set-collection",
    method: "put",
    path: "/publishing/collections/{collectionID}",
    summary: "Configure collection publishing",
    description:
      "Enables publishing for a collection, or disables it and unpublishes its tree from all channels. When enabling, publish can also publish the latest entry versions.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example",
      enabled: true,
      publish: false
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Collection to configure"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshots",
        location: "body",
        required: false,
        schema: {
          type: "object",
          propertyNames: {
            type: "string",
            minLength: 1,
            maxLength: 50
          },
          additionalProperties: {
            type: "string",
            pattern: "^snp_[A-Za-z\\d]{1,22}$"
          },
          description:
            "Optional snapshot checks for supplied channels before changing collection publishing. Omitted channels are not checked."
        },
        flag: "expected-snapshots",
        kind: "json",
        nullable: false
      },
      {
        name: "enabled",
        location: "body",
        required: true,
        schema: {
          type: "boolean",
          description:
            "Enable publishing, or disable and unpublish the collection tree from all channels"
        },
        flag: "enabled",
        kind: "boolean",
        nullable: false
      },
      {
        name: "publish",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          description: "Whether to publish latest entry versions when enabling publishing"
        },
        flag: "publish",
        kind: "boolean",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.unpublishCollection",
    group: "publishing",
    command: "unpublish-collection",
    method: "delete",
    path: "/publishing/collections/{collectionID}",
    summary: "Unpublish a collection tree",
    description:
      "Removes publication assignments for a collection tree from the channel. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example",
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Collection tree to unpublish"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description:
            "Reject the mutation if the channel no longer points to this reviewed snapshot"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "publishing.unpublishEntry",
    group: "publishing",
    command: "unpublish-entry",
    method: "delete",
    path: "/publishing/entries/{entryID}",
    summary: "Unpublish an entry",
    description:
      "Removes the entry publication from the channel. Supply versionID to require that version to be assigned; a changed assignment returns a conflict. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.\n\nRequired API key permissions: publishing. Write permissions also grant read access for the same resource.",
    example: {
      entryID: "ent_example",
      channel: "published",
      versionID: "ver_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "entryID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Entry to unpublish"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          default: "published",
          description: "Publishing channel, defaults to published"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSnapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$",
          description:
            "Reject the mutation if the channel no longer points to this reviewed snapshot"
        },
        flag: "expected-snapshot-id",
        kind: "string",
        nullable: false
      },
      {
        name: "versionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Version expected to be assigned"
        },
        flag: "version-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "roles.create",
    group: "roles",
    command: "create",
    method: "post",
    path: "/roles",
    summary: "Create a role",
    description:
      "Creates a workspace role. Names are unique without regard to case and must contain 1 to 50 characters after trimming. Requires the Pro plan and permission to delegate the selected permissions.\n\nRequired API key permissions: roles. Write permissions also grant read access for the same resource.",
    example: {
      name: "Editor",
      permissions: ["content"]
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "Name of the role"
        },
        flag: "name",
        kind: "string",
        nullable: false
      },
      {
        name: "permissions",
        location: "body",
        required: true,
        schema: {
          type: "array",
          items: {
            $ref: "#/components/schemas/Permission"
          },
          description: "Permissions to grant to the role"
        },
        flag: "permissions",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "roles.delete",
    group: "roles",
    command: "delete",
    method: "delete",
    path: "/roles/{id}",
    summary: "Delete a role",
    description:
      "Deletes a custom role and updates its assignments. Built-in roles cannot be deleted. Requires the Pro plan.\n\nRequired API key permissions: roles. Write permissions also grant read access for the same resource.",
    example: {
      id: "rl_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the role to delete"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "roles.list",
    group: "roles",
    command: "list",
    method: "get",
    path: "/roles",
    summary: "List roles",
    description:
      "Returns workspace roles and their permissions.\n\nRequired API key permissions: read:roles. Write permissions also grant read access for the same resource.",
    example: {},
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "roles.update",
    group: "roles",
    command: "update",
    method: "put",
    path: "/roles/{id}",
    summary: "Update a role",
    description:
      "Changes a role name or permissions. Names are unique without regard to case. Requires the Pro plan and permission to delegate the selected permissions. Built-in roles have additional restrictions.\n\nRequired API key permissions: roles. Write permissions also grant read access for the same resource.",
    example: {
      id: "rl_example",
      name: "Content editor"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the role to update"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "New name for the role"
        },
        flag: "name",
        kind: "string",
        nullable: false
      },
      {
        name: "permissions",
        location: "body",
        required: false,
        schema: {
          type: "array",
          items: {
            $ref: "#/components/schemas/Permission"
          },
          description: "New permissions for the role"
        },
        flag: "permissions",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "schemaMigrations.get",
    group: "schema-migrations",
    command: "get",
    method: "get",
    path: "/schema-migrations/{id}",
    summary: "Get schema migration status",
    description:
      "Returns bounded migration progress and status. Use schemaMigrations.listContentLossEntries for per-entry content loss details. Check status before repeating an operation blocked by this migration.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      id: "smg_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the schema migration"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemaMigrations.getActive",
    group: "schema-migrations",
    command: "get-active",
    method: "get",
    path: "/collections/{collectionID}/schema-migration",
    summary: "Get the active schema migration",
    description:
      "Returns the active migration for a collection, or null when none is active.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the affected collection"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemaMigrations.listContentLossEntries",
    group: "schema-migrations",
    command: "list-content-loss-entries",
    method: "get",
    path: "/schema-migrations/{id}/content-loss-entries",
    summary: "List entries with migration content loss",
    description:
      "Lists accessible, non-deleted entries that lost content in a completed migration. Returns an empty page until completion. Use pagination.nextCursor to continue.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      id: "smg_example",
      limit: 20
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page; keep the same filters"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "cursor"
  },
  {
    id: "schemas.apply",
    group: "schemas",
    command: "apply",
    method: "post",
    path: "/schemas/{schemaID}/apply",
    summary: "Apply a schema draft",
    description:
      "Creates a schema version from the draft and starts any required migration of affected entry content. Review possible content removal before calling: confirmedDataLoss must be true. Use schemaMigrations.get to follow a returned migrationID.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      schemaID: "sch_example",
      confirmedDataLoss: true,
      name: "Reviewed schema"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "schemaID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the local collection schema"
        },
        flag: "schema-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "confirmedDataLoss",
        location: "body",
        required: true,
        schema: {
          const: true,
          description: "Confirmation that the migration can remove entry content"
        },
        flag: "confirmed-data-loss",
        kind: "boolean",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 100,
          description: "Optional version name"
        },
        flag: "name",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemas.create",
    group: "schemas",
    command: "create",
    method: "post",
    path: "/collections/{collectionID}/schema",
    summary: "Create a local collection schema",
    description:
      "Creates a local schema draft for the collection. Use schemas.get to inspect local and effective schemas.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the collection"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemas.delete",
    group: "schemas",
    command: "delete",
    method: "delete",
    path: "/schemas/{schemaID}",
    summary: "Delete a local schema",
    description:
      "Removes the local schema and recalculates inherited schemas. This can start a content migration. Review possible content removal before setting confirmedDataLoss. Use schemaMigrations.get with a returned migrationID.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      schemaID: "sch_example",
      confirmedDataLoss: false
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "schemaID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the local collection schema"
        },
        flag: "schema-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "confirmedDataLoss",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          default: false,
          description: "Confirmation that an inherited-schema migration can remove entry content"
        },
        flag: "confirmed-data-loss",
        kind: "boolean",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemas.get",
    group: "schemas",
    command: "get",
    method: "get",
    path: "/schemas/collection",
    summary: "Get collection schemas",
    description:
      "Returns local and effective schema details for the collection, including inheritance.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      collectionID: "coll_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "collectionID",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "query",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemas.getRevision",
    group: "schemas",
    command: "get-revision",
    method: "get",
    path: "/schema-revisions/{revisionID}",
    summary: "Get an exact schema revision",
    description:
      "Returns the recorded effective definition, including inherited fields. Requires read access to the revision's collection. The definition is independent of the currently active schema.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      revisionID: "schr_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "revisionID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^schr_[A-Za-z\\d]{1,22}$"
        },
        flag: "revision-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemaVersions.get",
    group: "schema-versions",
    command: "get",
    method: "get",
    path: "/schema-versions/{id}",
    summary: "Get a schema version",
    description:
      "Returns a saved schema version and its definition.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      id: "schv_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the schema version"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemaVersions.list",
    group: "schema-versions",
    command: "list",
    method: "get",
    path: "/schemas/{schemaID}/versions",
    summary: "List schema versions",
    description:
      "Lists versions of a local collection schema. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      schemaID: "sch_example",
      limit: 20
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "schemaID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the local collection schema"
        },
        flag: "schema-id",
        kind: "string",
        nullable: false
      },
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum versions to return"
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "cursor"
  },
  {
    id: "schemaVersions.revert",
    group: "schema-versions",
    command: "revert",
    method: "post",
    path: "/schema-versions/{id}/revert",
    summary: "Restore a schema version",
    description:
      "Restores the selected definition and starts any required content migration. Review possible content removal before calling: confirmedDataLoss must be true. Use schemaMigrations.get to follow a returned migrationID.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      id: "schv_example",
      confirmedDataLoss: true
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the schema version to restore"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "confirmedDataLoss",
        location: "body",
        required: true,
        schema: {
          const: true,
          description: "Confirmation that the migration can remove entry content"
        },
        flag: "confirmed-data-loss",
        kind: "boolean",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 100,
          description: "Optional version name"
        },
        flag: "name",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "schemaVersions.update",
    group: "schema-versions",
    command: "update",
    method: "patch",
    path: "/schema-versions/{id}",
    summary: "Rename a schema version",
    description:
      "Changes the saved version name. Set name to null to remove the name.\n\nRequired API key permissions: collections. Write permissions also grant read access for the same resource.",
    example: {
      id: "schv_example",
      name: "Reviewed schema"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the schema version"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: true,
        schema: {
          anyOf: [
            {
              type: "string",
              minLength: 1,
              maxLength: 100
            },
            {
              type: "null"
            }
          ],
          description: "New version name, or null to remove it"
        },
        flag: "name",
        kind: "string",
        nullable: true
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "search.askCurrent",
    group: "search",
    command: "ask-current",
    method: "post",
    path: "/search/current/ask",
    summary: "Ask AI about current content",
    description:
      "Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses the existing Ask AI rate limit. Keep API keys on your server.\n\nRequired API key permissions: ai-answers, read:entries, read:collections. Write permissions also grant read access for the same resource.",
    example: {
      question: "How do I install Andesine?"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "question",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 1000
        },
        flag: "question",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "body",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "filters",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 20,
          items: {
            $ref: "#/components/schemas/PropertyFilter"
          },
          default: []
        },
        flag: "filters",
        kind: "json",
        nullable: false
      },
      {
        name: "history",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 10,
          items: {
            $ref: "#/components/schemas/AnswerHistoryMessage"
          },
          default: []
        },
        flag: "history",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "search.askCurrentStream",
    group: "search",
    command: "ask-current-stream",
    method: "post",
    path: "/search/current/ask/stream",
    summary: "Stream an AI answer about current content",
    description:
      "Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically.\n\nRequired API key permissions: ai-answers, read:entries, read:collections. Write permissions also grant read access for the same resource.",
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "question",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 1000
        },
        flag: "question",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "body",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "filters",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 20,
          items: {
            $ref: "#/components/schemas/PropertyFilter"
          },
          default: []
        },
        flag: "filters",
        kind: "json",
        nullable: false
      },
      {
        name: "history",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 10,
          items: {
            $ref: "#/components/schemas/AnswerHistoryMessage"
          },
          default: []
        },
        flag: "history",
        kind: "json",
        nullable: false
      }
    ],
    conditional: false,
    response: "stream"
  },
  {
    id: "search.askPublished",
    group: "search",
    command: "ask-published",
    method: "post",
    path: "/search/published/ask",
    summary: "Ask AI about published content",
    description:
      "Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses the existing Ask AI rate limit. Keep API keys on your server.\n\nRequired API key permissions: ai-answers, read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      question: "How do I install Andesine?",
      channel: "published"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "question",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 1000
        },
        flag: "question",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "body",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "filters",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 20,
          items: {
            $ref: "#/components/schemas/PropertyFilter"
          },
          default: []
        },
        flag: "filters",
        kind: "json",
        nullable: false
      },
      {
        name: "history",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 10,
          items: {
            $ref: "#/components/schemas/AnswerHistoryMessage"
          },
          default: []
        },
        flag: "history",
        kind: "json",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "Publishing channel to search"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "search.askPublishedStream",
    group: "search",
    command: "ask-published-stream",
    method: "post",
    path: "/search/published/ask/stream",
    summary: "Stream an AI answer about published content",
    description:
      "Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically.\n\nRequired API key permissions: ai-answers, read:publishing. Write permissions also grant read access for the same resource.",
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "question",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 1000
        },
        flag: "question",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "body",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "filters",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 20,
          items: {
            $ref: "#/components/schemas/PropertyFilter"
          },
          default: []
        },
        flag: "filters",
        kind: "json",
        nullable: false
      },
      {
        name: "history",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 10,
          items: {
            $ref: "#/components/schemas/AnswerHistoryMessage"
          },
          default: []
        },
        flag: "history",
        kind: "json",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "Publishing channel to search"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "stream"
  },
  {
    id: "search.current",
    group: "search",
    command: "current",
    method: "post",
    path: "/search/current",
    summary: "Search current content",
    description:
      "Searches current entry content by text and optional property filters. Up to 20 filters and 50 results are allowed. Semantic search is optional and has a separate rate limit.\n\nRequired API key permissions: read:entries, read:collections. Write permissions also grant read access for the same resource.",
    example: {
      query: "installation",
      limit: 10
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "query",
        location: "body",
        required: true,
        schema: {
          type: "string",
          maxLength: 500
        },
        flag: "query",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "body",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "filters",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 20,
          items: {
            $ref: "#/components/schemas/PropertyFilter"
          },
          default: []
        },
        flag: "filters",
        kind: "json",
        nullable: false
      },
      {
        name: "limit",
        location: "body",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          default: 20
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "semantic",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          default: false,
          description: "Whether to combine keyword and vector search"
        },
        flag: "semantic",
        kind: "boolean",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "search.published",
    group: "search",
    command: "published",
    method: "post",
    path: "/search/published",
    summary: "Search published content",
    description:
      "Searches content published to the required channel. Up to 20 filters and 50 results are allowed. Semantic search is optional and has a separate rate limit.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      query: "installation",
      channel: "published",
      limit: 10
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "query",
        location: "body",
        required: true,
        schema: {
          type: "string",
          maxLength: 500
        },
        flag: "query",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^coll_[A-Za-z\\d]{1,22}$"
        },
        flag: "collection-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collectionPath",
        location: "body",
        required: false,
        schema: {
          type: "string",
          description:
            "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
        },
        flag: "collection-path",
        kind: "string",
        nullable: false
      },
      {
        name: "filters",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 20,
          items: {
            $ref: "#/components/schemas/PropertyFilter"
          },
          default: []
        },
        flag: "filters",
        kind: "json",
        nullable: false
      },
      {
        name: "limit",
        location: "body",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          default: 20
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "semantic",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          default: false,
          description: "Whether to combine keyword and vector search"
        },
        flag: "semantic",
        kind: "boolean",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: true,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50,
          description: "Publishing channel to search"
        },
        flag: "channel",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "typeMetadata.getCurrent",
    group: "type-metadata",
    command: "get-current",
    method: "post",
    path: "/type-metadata/current",
    summary: "Get current content type metadata",
    description:
      "Read-only bulk metadata for type generation. Returns one consistent database snapshot of accessible collections and their active effective schemas, including inheritance. Optional entry/tree data requires read:entries in addition to read:collections. Explicit unavailable collection selectors fail. Active schema migrations in the selected collections return a conflict. No entry content is loaded. Schema-free collections use general types without warnings.\n\nRequired API key permissions: read:collections. Write permissions also grant read access for the same resource.",
    example: {
      collections: ["/Tutorials"],
      includeEntries: false
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collections",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 100,
          items: {
            anyOf: [
              {
                type: "string",
                pattern: "^coll_[A-Za-z\\d]{1,22}$"
              },
              {
                type: "string",
                description:
                  "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
              }
            ]
          },
          default: [],
          description:
            "Collection IDs or paths. Includes selected subtrees; empty selects all accessible collections."
        },
        flag: "collections",
        kind: "json",
        nullable: false
      },
      {
        name: "includeEntries",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          default: false,
          description: "Include entry IDs, names, paths, and schema associations."
        },
        flag: "include-entries",
        kind: "boolean",
        nullable: false
      },
      {
        name: "includeTree",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          default: false,
          description:
            "Include ordered child IDs for each collection. Also includes entry metadata."
        },
        flag: "include-tree",
        kind: "boolean",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "typeMetadata.getPublished",
    group: "type-metadata",
    command: "get-published",
    method: "post",
    path: "/type-metadata/published",
    summary: "Get published content type metadata",
    description:
      "Read-only bulk metadata for type generation. Resolves a channel once (published by default), or reads a retained snapshot. Uses publication paths, names, and exact entry-version schema revisions; never substitutes current schemas. Supports mixed revisions and schema-free entries. Empty collections use general types without warnings. Includes selected subtrees; no selectors means all published collections and root entries. Publication-access rules match content.get. No entry content is loaded. Reuse source.snapshotID for related reads. The fingerprint changes only when returned type metadata changes, not when content-only publication creates a new snapshot.\n\nRequired API key permissions: read:publishing. Write permissions also grant read access for the same resource.",
    example: {
      channel: "published",
      collections: ["/Tutorials"]
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "collections",
        location: "body",
        required: false,
        schema: {
          type: "array",
          maxItems: 100,
          items: {
            anyOf: [
              {
                type: "string",
                pattern: "^coll_[A-Za-z\\d]{1,22}$"
              },
              {
                type: "string",
                description:
                  "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
              }
            ]
          },
          default: [],
          description:
            "Collection IDs or paths. Includes selected subtrees; empty selects all accessible collections."
        },
        flag: "collections",
        kind: "json",
        nullable: false
      },
      {
        name: "includeEntries",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          default: false,
          description: "Include entry IDs, names, paths, and schema associations."
        },
        flag: "include-entries",
        kind: "boolean",
        nullable: false
      },
      {
        name: "includeTree",
        location: "body",
        required: false,
        schema: {
          type: "boolean",
          default: false,
          description:
            "Include ordered child IDs for each collection. Also includes entry metadata."
        },
        flag: "include-tree",
        kind: "boolean",
        nullable: false
      },
      {
        name: "channel",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 50
        },
        flag: "channel",
        kind: "string",
        nullable: false
      },
      {
        name: "snapshotID",
        location: "body",
        required: false,
        schema: {
          type: "string",
          pattern: "^snp_[A-Za-z\\d]{1,22}$"
        },
        flag: "snapshot-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "versions.create",
    group: "versions",
    command: "create",
    method: "post",
    path: "/entries/{entryID}/versions",
    summary: "Create an entry version",
    description:
      "Saves a version of the current entry content. Optionally assigns a name.\n\nRequired API key permissions: versions. Write permissions also grant read access for the same resource.",
    example: {
      entryID: "ent_example",
      name: "Before release"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "entryID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the entry to version"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: false,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 100,
          description: "Optional version name"
        },
        flag: "name",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "versions.get",
    group: "versions",
    command: "get",
    method: "get",
    path: "/versions/{id}",
    summary: "Get an entry version",
    description:
      "Returns the saved content and recorded schema metadata of an entry version. Validates against its recorded revision, including historical versions. expectedSchemaHash must match that revision; schema-less content cannot match it.\n\nRequired API key permissions: read:versions. Write permissions also grant read access for the same resource.",
    example: {
      id: "ver_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the version to get"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "expectedSchemaHash",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^[a-f\\d]{64}$",
          description: "Hash of the effective schema definition"
        },
        flag: "expected-schema-hash",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "versions.list",
    group: "versions",
    command: "list",
    method: "get",
    path: "/entries/{entryID}/versions",
    summary: "List entry versions",
    description:
      "Lists saved entry versions. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.\n\nRequired API key permissions: read:versions. Write permissions also grant read access for the same resource.",
    example: {
      entryID: "ent_example",
      limit: 20
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "entryID",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the entry whose versions to list"
        },
        flag: "entry-id",
        kind: "string",
        nullable: false
      },
      {
        name: "cursor",
        location: "query",
        required: false,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "Cursor from the previous page"
        },
        flag: "cursor",
        kind: "string",
        nullable: false
      },
      {
        name: "limit",
        location: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum versions to return"
        },
        flag: "limit",
        kind: "number",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json",
    pagination: "cursor"
  },
  {
    id: "versions.revert",
    group: "versions",
    command: "revert",
    method: "post",
    path: "/versions/{id}/revert",
    summary: "Restore an entry version",
    description:
      "Restores saved content to the current entry and returns the resulting version. An active schema migration can block this action.\n\nRequired API key permissions: versions. Write permissions also grant read access for the same resource.",
    example: {
      id: "ver_example"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the version to restore"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      }
    ],
    conditional: false,
    response: "json"
  },
  {
    id: "versions.update",
    group: "versions",
    command: "update",
    method: "patch",
    path: "/versions/{id}",
    summary: "Rename an entry version",
    description:
      "Changes the saved version name. Set name to null to remove the name.\n\nRequired API key permissions: versions. Write permissions also grant read access for the same resource.",
    example: {
      id: "ver_example",
      name: "Release candidate"
    },
    security: [
      {
        apiKey: []
      },
      {
        oauth: []
      }
    ],
    fields: [
      {
        name: "id",
        location: "path",
        required: true,
        schema: {
          type: "string",
          pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
          description: "ID of the version to update"
        },
        flag: "id",
        kind: "string",
        nullable: false
      },
      {
        name: "x-workspace-id",
        location: "header",
        required: false,
        schema: {
          type: "string",
          description:
            "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
        },
        flag: "x-workspace-id",
        kind: "string",
        nullable: false
      },
      {
        name: "name",
        location: "body",
        required: true,
        schema: {
          anyOf: [
            {
              type: "string",
              minLength: 1,
              maxLength: 100
            },
            {
              type: "null"
            }
          ],
          description: "New version name, or null to remove it"
        },
        flag: "name",
        kind: "string",
        nullable: true
      }
    ],
    conditional: false,
    response: "empty"
  },
  {
    id: "workspaces.list",
    group: "workspaces",
    command: "list",
    method: "get",
    path: "/workspaces",
    summary: "List available workspaces",
    description:
      "Lists workspaces available to the OAuth user, with current role permissions and plan access. Browser sessions can list workspaces across signed-in accounts. Does not require workspace selection and does not count toward API usage.",
    security: [
      {
        oauth: []
      }
    ],
    fields: [],
    conditional: false,
    response: "json"
  }
];
const schemas: Record<string, JSONSchema> = {
  PropertyFilter: {
    anyOf: [
      {
        $ref: "#/components/schemas/TextPropertyFilter"
      },
      {
        $ref: "#/components/schemas/NumberPropertyFilter"
      },
      {
        $ref: "#/components/schemas/BooleanPropertyFilter"
      },
      {
        $ref: "#/components/schemas/DatePropertyFilter"
      }
    ]
  },
  TextPropertyFilter: {
    type: "object",
    properties: {
      kind: {
        const: "text"
      },
      key: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Property identifier"
      },
      operator: {
        enum: ["any", "all", "none"],
        type: "string",
        default: "any"
      },
      values: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: {
          type: "string",
          maxLength: 500
        }
      }
    },
    required: ["kind", "key", "values"]
  },
  NumberPropertyFilter: {
    type: "object",
    properties: {
      kind: {
        const: "number"
      },
      key: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Property identifier"
      },
      operator: {
        $ref: "#/components/schemas/ComparisonOperator"
      },
      value: {
        type: "number"
      }
    },
    required: ["kind", "key", "operator", "value"]
  },
  ComparisonOperator: {
    enum: [
      "equals",
      "notEquals",
      "greaterThan",
      "greaterThanOrEqual",
      "lessThan",
      "lessThanOrEqual"
    ],
    type: "string"
  },
  BooleanPropertyFilter: {
    type: "object",
    properties: {
      kind: {
        const: "boolean"
      },
      key: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Property identifier"
      },
      value: {
        type: "boolean"
      }
    },
    required: ["kind", "key", "value"]
  },
  DatePropertyFilter: {
    type: "object",
    properties: {
      kind: {
        const: "date"
      },
      key: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Property identifier"
      },
      operator: {
        $ref: "#/components/schemas/ComparisonOperator"
      },
      value: {
        type: "string"
      }
    },
    required: ["kind", "key", "operator", "value"]
  },
  Permission: {
    enum: [
      "content",
      "publishing",
      "api_keys",
      "read:api_keys",
      "billing",
      "read:billing",
      "restricted_collections",
      "read:restricted_collections",
      "memberships",
      "roles",
      "workspace"
    ],
    type: "string"
  },
  AnswerHistoryMessage: {
    type: "object",
    properties: {
      role: {
        enum: ["user", "assistant"],
        type: "string"
      },
      content: {
        type: "string",
        minLength: 1,
        maxLength: 4000
      }
    },
    required: ["role", "content"]
  },
  PublishEntryTarget: {
    type: "object",
    properties: {
      entryID: {
        type: "string",
        pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
        description: "Entry to publish"
      },
      versionID: {
        type: "string",
        pattern: "^(?:\\w+?_[A-Za-z\\d]{1,22})$",
        description: "Existing version to publish"
      }
    },
    required: ["entryID"]
  }
};
export { commands, schemas };
