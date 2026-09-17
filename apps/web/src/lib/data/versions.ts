import { createAsync, query } from "@solidjs/router";
import { client } from "#web/lib/api";

interface VersionHistoryQueryInput {
  entryID: string;
  cursor?: string;
  limit?: number;
}

interface VersionDetailsQueryInput {
  id: string;
}
interface PublishedVersionDetailsQueryInput {
  entryID: string;
  snapshotID: string;
}

interface VersionQueryResult<T> {
  result?: T;
  error?: true;
}

type VersionListPage = Awaited<ReturnType<typeof client.versions.list>>;
type VersionSummary = VersionListPage["data"][number];
type VersionReason = VersionSummary["reason"];
type VersionDetails = Awaited<ReturnType<typeof client.versions.get>>;

const getQueryResult = async <T>(request: () => Promise<T>): Promise<VersionQueryResult<T>> => {
  try {
    return { result: await request() };
  } catch (error) {
    console.error(error);

    return { error: true };
  }
};
const entryDraftQuery = query(
  (input: VersionDetailsQueryInput) => getQueryResult(() => client.entries.get(input)),
  "entry-draft"
);

const versionHistoryQuery = query(
  (input: VersionHistoryQueryInput) => getQueryResult(() => client.versions.list(input)),
  "version-history"
);
const versionDetailsQuery = query(
  (input: VersionDetailsQueryInput) => getQueryResult(() => client.versions.get(input)),
  "version-details"
);
const publishedVersionDetailsQuery = query((input: PublishedVersionDetailsQueryInput) => {
  return getQueryResult(() => client.publishing.getEntryVersion(input));
}, "published-version-details");
const createKeyedResponse = <T>(
  key: () => string,
  request: (id: string) => Promise<VersionQueryResult<T>>
) => {
  const resource = createAsync(async () => {
    const id = key();

    if (!id) return null;

    return {
      id,
      response: await request(id)
    };
  });

  return () => {
    const latest = resource.latest;

    if (latest?.id === key()) return latest.response;

    return resource()?.response;
  };
};
const createEntryDraftResponse = (entryID: () => string) => {
  return createKeyedResponse(entryID, (id) => entryDraftQuery({ id }));
};
const createVersionDetailsResponse = (versionID: () => string) => {
  return createKeyedResponse(versionID, (id) => versionDetailsQuery({ id }));
};
const createPublishedVersionDetailsResponse = (entryID: () => string, snapshotID: () => string) => {
  const getKey = () => {
    const selectedEntryID = entryID();
    const selectedSnapshotID = snapshotID();

    return selectedEntryID && selectedSnapshotID ? `${selectedEntryID}:${selectedSnapshotID}` : "";
  };

  return createKeyedResponse(getKey, (key) => {
    const [selectedEntryID, selectedSnapshotID] = key.split(":");

    return publishedVersionDetailsQuery({
      entryID: selectedEntryID,
      snapshotID: selectedSnapshotID
    });
  });
};

export {
  createEntryDraftResponse,
  createPublishedVersionDetailsResponse,
  createVersionDetailsResponse,
  entryDraftQuery,
  publishedVersionDetailsQuery,
  versionDetailsQuery,
  versionHistoryQuery
};
export type {
  VersionDetails,
  VersionDetailsQueryInput,
  VersionHistoryQueryInput,
  PublishedVersionDetailsQueryInput,
  VersionListPage,
  VersionQueryResult,
  VersionReason,
  VersionSummary
};
