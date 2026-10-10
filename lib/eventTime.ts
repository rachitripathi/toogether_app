import type { Event } from '@/lib/types';

// An event counts as "past" from its start time onward — the same cutoff the
// join_requests insert policy uses (migration 011: `date_time > now()`), so any
// plan the feed shows is one the user can still actually request to join.
export const hasEventStarted = (event: Pick<Event, 'dateTime'>, now: number = Date.now()) =>
  new Date(event.dateTime).getTime() <= now;

// 6 hours after its start a plan is archived (migration 016): it stays only as a list entry in
// its host's and approved members' Past plans, with details and chat closed. RLS enforces this
// server-side; these helpers just keep the UI in step without waiting for a refetch.
export const ARCHIVE_AFTER_HOURS = 6;

export const archivesAt = (event: Pick<Event, 'dateTime'>) =>
  new Date(new Date(event.dateTime).getTime() + ARCHIVE_AFTER_HOURS * 60 * 60 * 1000);

export const isEventArchived = (event: Pick<Event, 'dateTime'>, now: number = Date.now()) =>
  archivesAt(event).getTime() <= now;

// Started but not archived yet: the plan's day-of window, when its host and members still need
// the details and chat. Home and Profile -> Hosting/Joined show these as "Happening now".
export const isHappeningNow = (event: Pick<Event, 'dateTime'>, now: number = Date.now()) =>
  hasEventStarted(event, now) && !isEventArchived(event, now);

export const formatClockTime = (date: Date) => date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// The events.time_slot label for a start time (local hours). Stored alongside date_time and
// shown on cards; recomputed whenever the time changes.
export function timeSlotFor(date: Date): Event['timeSlot'] {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

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
