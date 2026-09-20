import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "#backend/lib/api/limits";
import { id } from "#backend/lib/primitives";
import * as z from "zod";

const pageInputType = z.object({
  cursor: id().optional().describe("Cursor from the previous page; keep the same filters"),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
});
const paginationType = z.object({
  nextCursor: id().nullable(),
  hasMore: z.boolean()
});

export { pageInputType, paginationType };
