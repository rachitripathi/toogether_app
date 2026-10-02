import type { Event } from '@/lib/types';

// An event counts as "past" from its start time onward — the same cutoff the
// join_requests insert policy uses (migration 011: `date_time > now()`), so any
// plan the feed shows is one the user can still actually request to join.
export const hasEventStarted = (event: Pick<Event, 'dateTime'>, now: number = Date.now()) =>
  new Date(event.dateTime).getTime() <= now;

// When-buckets for the Home feed, in display order. Calendar days in the device's local
// time, so a plan at 11pm tonight is "Today" and one at 1am is "Tomorrow".
export const TIME_BUCKETS = ['Today', 'Tomorrow', 'This week', 'Later'] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const getTimeBucket = (startsAt: number, now: number = Date.now()): TimeBucket => {
  // Math.round absorbs the ±1h of a DST shift between the two midnights.
  const daysAhead = Math.round((startOfDay(startsAt) - startOfDay(now)) / 86_400_000);
  if (daysAhead <= 0) return 'Today';
  if (daysAhead === 1) return 'Tomorrow';
  if (daysAhead < 7) return 'This week';
  return 'Later';
};
