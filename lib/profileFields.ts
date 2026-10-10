// Length caps for the free-text profile fields (edit-profile, new-user-profile). Enforced by
// the inputs' maxLength and shown as a live counter; not DB-enforced.
export const PROFILE_LIMITS = {
  name: 40,
} as const;

// Single-line text: trims, and collapses runs of spaces/tabs/newlines into one space, so
// "   " saves as "" (and is then caught as blank) instead of a name made of spaces.
export const cleanLine = (value: string) => value.replace(/\s+/g, ' ').trim();

// Multi-line text (descriptions, report reasons): trims each end and squeezes 3+ consecutive line breaks to one blank line.
export const cleanMultiline = (value: string) =>
  value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function validateName(value: string): string {
  const name = cleanLine(value);
  if (!name) return "Name can't be blank.";
  if (name.length < 2) return 'Name needs at least 2 characters.';
  // Anything that isn't a digit or ASCII punctuation counts as a letter (covers non-Latin scripts).
  if (!/[^\s\d!-/:-@[-`{-~]/.test(name)) return 'Name needs at least one letter.';
  return '';
}

// Plan fields (create-event + the event Edit plan sheet). Mirrored server-side by the
// validate_event() trigger, migration 015.
export const PLAN_LIMITS = {
  title: 60,
  titleMin: 3,
  description: 200,
  locationNote: 90,
  exactLocation: 200,
  minGroup: 2,
  maxGroup: 10,
  // A plan has to start at least this far ahead, so it can't already be under way when it's posted.
  minLeadMinutes: 15,
  // Latest start date, counted from today (migration 016 enforces it server-side).
  maxMonthsAhead: 1,
} as const;

// Whole number between 2 and 10 (the group size includes the host), or null if it isn't one.
export function parseGroupSize(value: string): number | null {
  const size = Number(value.trim());
  return value.trim() && Number.isInteger(size) && size >= PLAN_LIMITS.minGroup && size <= PLAN_LIMITS.maxGroup
    ? size
    : null;
}
