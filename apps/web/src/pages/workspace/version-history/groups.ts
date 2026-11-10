import {
  addHours,
  endOfWeek,
  format,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subHours,
  subMonths
} from "date-fns";
import type { VersionHistoryVersion } from "./item";

interface VersionTimeframe {
  key: string;
  label: string;
}
interface VersionHistoryGroup extends VersionTimeframe {
  versions: VersionHistoryVersion[];
}

const HOUR_GROUP_SIZE = 4;
const getTimeframe = (date: Date, now: Date): VersionTimeframe => {
  if (date > subHours(now, 24)) {
    const hour = Math.floor(date.getHours() / HOUR_GROUP_SIZE) * HOUR_GROUP_SIZE;
    const start = setHours(startOfDay(date), hour);

    return {
      key: `hours-${start.getTime()}`,
      label: `${format(start, "HH:mm")} - ${format(addHours(start, HOUR_GROUP_SIZE), "HH:mm")}`
    };
  }

  if (date > subDays(now, 7)) {
    const start = startOfDay(date);

    return { key: `day-${start.getTime()}`, label: format(start, "MMM d") };
  }

  if (date > subMonths(now, 1)) {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });

    return {
      key: `week-${start.getTime()}`,
      label: `${format(start, "MMM d")} – ${format(end, "MMM d")}`
    };
  }

  const start = startOfMonth(date);

  return { key: `month-${start.getTime()}`, label: format(start, "MMMM yyyy") };
};
/** Groups newest-first versions by timeframe; `isSeparate` versions keep their own rows. */
const groupVersions = (
  versions: VersionHistoryVersion[],
  isSeparate: (version: VersionHistoryVersion) => boolean
): VersionHistoryGroup[] => {
  const now = new Date();
  const groups: VersionHistoryGroup[] = [];
  const groupsByKey = new Map<string, VersionHistoryGroup>();

  for (const version of versions) {
    const timeframe = getTimeframe(new Date(version.createdAt), now);

    if (isSeparate(version)) {
      groups.push({ ...timeframe, key: version.id, versions: [version] });
      continue;
    }

    const group = groupsByKey.get(timeframe.key);

    if (group) {
      group.versions.push(version);
      continue;
    }

    const newGroup = { ...timeframe, versions: [version] };

    groups.push(newGroup);
    groupsByKey.set(timeframe.key, newGroup);
  }

  return groups;
};

export { groupVersions };
export type { VersionHistoryGroup };
