// Transport returns only a bounded receiver hint; the ledger schedules retries.
const parseRetryAfter = (value: string | null, now: Date, deadline: Date): Date | null => {
  if (!value || value.length > 128) return null;

  const trimmed = value.trim();
  const seconds = /^\d+$/.test(trimmed);
  const date = seconds ? null : new Date(trimmed);
  const validDate = date && Number.isFinite(+date) && date.toUTCString() === trimmed;
  const requested = seconds ? +now + Number(trimmed) * 1000 : validDate ? +date : NaN;

  if (Number.isNaN(requested) || requested < +now || +deadline <= +now) return null;

  return new Date(Math.min(requested, +deadline));
};

export { parseRetryAfter };
