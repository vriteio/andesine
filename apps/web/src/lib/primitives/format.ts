import { format, formatDistanceToNow } from "date-fns";

const currencyUSDFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});
const compactNumberFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });
const numberFormatter = new Intl.NumberFormat("en-US", { notation: "standard" });

const formatUSD = (value: number | string) => currencyUSDFormatter.format(Number(value));
const formatNumber = (value: number, options?: { compact?: boolean }): string => {
  if (options?.compact) {
    return compactNumberFormatter.format(value);
  }

  return numberFormatter.format(value);
};

// "5 minutes ago" or "in 3 minutes".
const formatRelativeTime = (date: Date | string) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};
const formatDate = (date: Date | string) => format(new Date(date), "MMM d, yyyy");
const formatDateTime = (date: Date | string) => format(new Date(date), "MMM d, yyyy HH:mm:ss");
const formatDuration = (durationMs: number | null): string | null => {
  if (durationMs === null) return null;

  return durationMs < 1000 ? `${durationMs} ms` : `${(durationMs / 1000).toFixed(1)} s`;
};

export { formatUSD, formatNumber, formatRelativeTime, formatDate, formatDateTime, formatDuration };
