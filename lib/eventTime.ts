import type { Event } from '@/lib/types';

// An event counts as "past" from its start time onward — the same cutoff the
// join_requests insert policy uses (migration 011: `date_time > now()`), so any
// plan the feed shows is one the user can still actually request to join.
export const hasEventStarted = (event: Pick<Event, 'dateTime'>, now: number = Date.now()) =>
  new Date(event.dateTime).getTime() <= now;
