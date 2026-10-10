import {
  extensionRegistryIndexType,
  extensionVersionManifestType,
  type ExtensionRegistryIndex,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions";
import {
  extensionRegistryKeys,
  extensionRegistryVersions,
  type Database,
  type DatabaseTransaction
} from "@andesine/server/database";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";

interface ExtensionRegistryRejection {
  name: string;
  version?: string;
  kid?: string;
  reason: string;
}
interface ExtensionRegistryVersions {
  versions: ExtensionVersionManifest[];
  rejected: ExtensionRegistryRejection[];
}
interface ExtensionRegistryIngestion {
  added: string[];
  revoked: string[];
  rejected: ExtensionRegistryRejection[];
}

const MAX_REGISTRY_SIZE = 10 * 1024 * 1024;
const REGISTRY_TIMEOUT_MS = 15_000;

class ExtensionRegistryError extends Error {}

const readBoundedText = async (response: Response): Promise<string> => {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];

  let size = 0;

  if (declaredSize > MAX_REGISTRY_SIZE || !reader) {
    throw new ExtensionRegistryError("The registry index is too large or empty");
  }

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;

    if (size > MAX_REGISTRY_SIZE) {
      await reader.cancel();
      throw new ExtensionRegistryError("The registry index is too large");
    }

    chunks.push(chunk.value);
  }

  return Buffer.concat(chunks).toString("utf8");
};
/** Reads and validates the registry index. It never loads or runs extension code. */
const fetchExtensionRegistry = async (url: string): Promise<ExtensionRegistryIndex> => {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new ExtensionRegistryError(`The registry responded with HTTP ${response.status}`);
  }

  let json: unknown;

  try {
    json = JSON.parse(await readBoundedText(response));
  } catch (error) {
    if (error instanceof ExtensionRegistryError) throw error;

    throw new ExtensionRegistryError("The registry index is not valid JSON");
  }

  const result = extensionRegistryIndexType.safeParse(json);

  if (!result.success) throw new ExtensionRegistryError("The registry index is not valid");

  return result.data;
};
/** Validates each version on its own, so one invalid or newer version skips only itself. */
const readExtensionRegistryVersions = (
  index: ExtensionRegistryIndex
): ExtensionRegistryVersions => {
  const versions: ExtensionVersionManifest[] = [];
  const rejected: ExtensionRegistryRejection[] = [];

  for (const entry of index.extensions) {
    const seen = new Set<string>();

    for (const input of entry.versions) {
      const result = extensionVersionManifestType.safeParse(input);
      const version = result.data?.manifest.version;

      if (!result.success) {
        rejected.push({ name: entry.name, reason: "The version manifest is not valid" });
      } else if (result.data.manifest.name !== entry.name) {
        rejected.push({
          name: entry.name,
          version,
          reason: "The manifest names another extension"
        });
      } else if (seen.has(result.data.manifest.version)) {
        rejected.push({ name: entry.name, version, reason: "The version is listed twice" });
      } else {
        seen.add(result.data.manifest.version);
        versions.push(result.data);
      }
    }
  }

  return { versions, rejected };
};
const ingestKeys = async (
  transaction: DatabaseTransaction,
  source: string,
  index: ExtensionRegistryIndex,
  rejected: ExtensionRegistryRejection[]
): Promise<void> => {
  const rows = await transaction.select().from(extensionRegistryKeys);
  const existing = new Map(rows.map((row) => [`${row.name} ${row.kid}`, row]));
  const sources = new Map(rows.map((row) => [row.name, row.source]));
  const current = new Set<string>();

  for (const entry of index.extensions) {
    const isOwner = (sources.get(entry.name) ?? source) === source;

    for (const kid of isOwner ? entry.revokedKeys : []) {
      const row = existing.get(`${entry.name} ${kid}`);

      if (!row) {
        await transaction
          .insert(extensionRegistryKeys)
          .values({ source, name: entry.name, kid, revokedAt: sql`now()` });
      } else if (!row.revokedAt) {
        await transaction
          .update(extensionRegistryKeys)
          .set({ current: false, revokedAt: sql`now()`, updatedAt: sql`now()` })
          .where(
            and(eq(extensionRegistryKeys.name, entry.name), eq(extensionRegistryKeys.kid, kid))
          );
      }
    }

    for (const key of entry.keys) {
      const row = existing.get(`${entry.name} ${key.kid}`);
      const rejection = { name: entry.name, kid: key.kid };

      if (!isOwner) {
        rejected.push({ ...rejection, reason: "Another registry publishes this extension" });
      } else if (!row) {
        await transaction.insert(extensionRegistryKeys).values({
          source,
          name: entry.name,
          kid: key.kid,
          key,
          current: true
        });
      } else if (row.source !== source) {
        rejected.push({ ...rejection, reason: "Another registry published this key" });
      } else if (row.revokedAt) {
        rejected.push({ ...rejection, reason: "A revoked key cannot become current again" });
      } else if (!isDeepStrictEqual(row.key, key)) {
        rejected.push({ ...rejection, reason: "Published keys are immutable" });
      } else {
        current.add(`${entry.name} ${key.kid}`);
      }
    }
  }

  for (const row of rows) {
    const isCurrent = current.has(`${row.name} ${row.kid}`);

    if (row.current !== isCurrent && !row.revokedAt) {
      await transaction
        .update(extensionRegistryKeys)
        .set({ current: isCurrent, updatedAt: sql`now()` })
        .where(
          and(eq(extensionRegistryKeys.name, row.name), eq(extensionRegistryKeys.kid, row.kid))
        );
    }
  }
};
/** Stores versions, keys, and revocations; `source` keeps other registries from taking names. */
const ingestExtensionRegistry = async (
  database: Database,
  source: string,
  index: ExtensionRegistryIndex
): Promise<ExtensionRegistryIngestion> => {
  const { versions, rejected } = readExtensionRegistryVersions(index);
  const names = index.extensions.map(({ name }) => name);

  return database.transaction(async (transaction) => {
    const added: string[] = [];
    const revoked: string[] = [];

    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext('andesine:extensions:registry'))`
    );
    await ingestKeys(transaction, source, index, rejected);

    const rows = names.length
      ? await transaction
          .select()
          .from(extensionRegistryVersions)
          .where(inArray(extensionRegistryVersions.name, names))
      : [];
    const existing = new Map(rows.map((row) => [`${row.name}@${row.version}`, row]));
    const sources = new Map(rows.map((row) => [row.name, row.source]));

    for (const version of versions) {
      const { name, version: versionName } = version.manifest;
      const id = `${name}@${versionName}`;
      const stored = existing.get(id);
      const rejection = { name, version: versionName };
      // The first registry to publish a name owns it, so a new registry URL cannot replace it.
      const isOwner = (sources.get(name) ?? source) === source;
      // Compare as JSON, as stored in jsonb.
      const isChanged =
        stored && !isDeepStrictEqual(stored.manifest, JSON.parse(JSON.stringify(version)));

      if (!isOwner) {
        rejected.push({ ...rejection, reason: "Another registry publishes this extension" });
      } else if (isChanged) {
        rejected.push({ ...rejection, reason: "Published versions are immutable" });
      } else if (!stored) {
        await transaction
          .insert(extensionRegistryVersions)
          .values({ source, name, version: versionName, manifest: version });
        added.push(id);
      }
    }

    for (const revocation of index.revocations) {
      const result = await transaction
        .update(extensionRegistryVersions)
        .set({
          revokedAt: sql`now()`,
          revocationReason: revocation.reason,
          replacementVersion: revocation.replacement
        })
        .where(
          and(
            eq(extensionRegistryVersions.source, source),
            eq(extensionRegistryVersions.name, revocation.name),
            eq(extensionRegistryVersions.version, revocation.version),
            isNull(extensionRegistryVersions.revokedAt)
          )
        )
        .returning({ name: extensionRegistryVersions.name });

      if (result.length) revoked.push(`${revocation.name}@${revocation.version}`);
    }

    return { added, revoked, rejected };
  });
};

export {
  ExtensionRegistryError,
  fetchExtensionRegistry,
  readExtensionRegistryVersions,
  ingestExtensionRegistry
};
export type { ExtensionRegistryRejection, ExtensionRegistryIngestion };
