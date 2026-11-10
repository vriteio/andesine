/** Used-up monthly quotas and spending limits show as unavailable, not as rate limits. */
const isRateLimited = (status: number, data: unknown): boolean => {
  const limit = (data as { limit?: string } | null | undefined)?.limit;

  return status === 429 && (limit === undefined || limit === "rate");
};
const readErrorData = async (response: Response): Promise<unknown> => {
  const body = (await response.json().catch(() => null)) as { data?: unknown } | null;

  return body?.data;
};

export { isRateLimited, readErrorData };
