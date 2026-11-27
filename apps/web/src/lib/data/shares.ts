import { query, revalidate } from "@solidjs/router";
import { client } from "#web/lib/api";

interface SharedEntriesQueryInput {
  pageCount: number;
  kind?: ShareKind;
  search?: string;
}

type Share = Awaited<ReturnType<typeof client.shares.list>>["data"][number];
type ShareKind = Share["kind"];
type SharedEntryPage = Awaited<ReturnType<typeof client.shares.listEntries>>;
type SharedEntry = SharedEntryPage["data"][number];
type IdentifiedVisitorPage = Awaited<ReturnType<typeof client.shares.listVisitors>>;
type IdentifiedVisitor = IdentifiedVisitorPage["data"][number];
type SharingPolicy = Awaited<ReturnType<typeof client.shares.getPolicy>>;

const DELETE_BATCH_SIZE = 500;

const sharesQuery = query(async (entryID: string): Promise<Share[]> => {
  return (await client.shares.list({ entryID })).data;
}, "shares");
// Rebuild the cursor chain on each refresh so page boundaries follow current results.
const sharedEntriesQuery = query(async (input: SharedEntriesQueryInput) => {
  const result: SharedEntryPage = { data: [], pagination: { nextCursor: null, hasMore: false } };

  for (let index = 0; index < input.pageCount; index++) {
    const page = await client.shares.listEntries({
      kind: input.kind,
      search: input.search || undefined,
      cursor: result.pagination.nextCursor ?? undefined,
      limit: 25
    });

    result.data.push(...page.data);
    result.pagination = page.pagination;

    if (!page.pagination.hasMore) break;
  }

  return result;
}, "shared-entries");
const identifiedVisitorsQuery = query(async (pageCount: number) => {
  const result: IdentifiedVisitorPage = {
    data: [],
    pagination: { nextCursor: null, hasMore: false }
  };

  for (let index = 0; index < pageCount; index++) {
    const page = await client.shares.listVisitors({
      cursor: result.pagination.nextCursor ?? undefined,
      limit: 25
    });

    result.data.push(...page.data);
    result.pagination = page.pagination;

    if (!page.pagination.hasMore) break;
  }

  return result;
}, "identified-visitors");
const sharingPolicyQuery = query(() => client.shares.getPolicy(), "sharing-policy");
/** One request takes at most 500 IDs. */
const deleteShares = async (ids: string[]) => {
  for (let index = 0; index < ids.length; index += DELETE_BATCH_SIZE) {
    await client.shares.deleteMany({ ids: ids.slice(index, index + DELETE_BATCH_SIZE) });
  }
};
const revalidateShares = () => {
  return revalidate([sharesQuery.key, sharedEntriesQuery.key, identifiedVisitorsQuery.key]);
};

export {
  deleteShares,
  identifiedVisitorsQuery,
  revalidateShares,
  sharedEntriesQuery,
  sharesQuery,
  sharingPolicyQuery
};
export type { IdentifiedVisitor, Share, ShareKind, SharedEntry, SharingPolicy };
