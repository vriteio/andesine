interface PageInput {
  cursor?: string;
  limit?: number;
}
interface Page<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean };
}

const toPage = <T extends { id: string }>(rows: T[], limit: number): Page<T> => {
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);

  return { data, pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1].id : null } };
};

export { toPage };
export type { Page, PageInput };
