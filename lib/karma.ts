import type { AppColors } from '@/lib/theme';

// Karma replaces star ratings. Nobody rates anybody: it's earned by doing things, and the
// server derives it from real rows every time it's read (get_karma(), migration 019), so it
// can't be set from the client and cancelling a plan takes back what that plan earned.
export type KarmaInfo = {
  karma: number;
  plansHosted: number;
  plansHostedHappened: number;
  guestsHosted: number;
  plansJoined: number;
  crewCount: number;
  verified: boolean;
  timesRemoved: number;
  lateCancels: number;
};

export type KarmaTier = { label: string; min: number; tone: 'muted' | 'info' | 'success' | 'warning' };

const TIERS: KarmaTier[] = [
  { label: 'Legend', min: 250, tone: 'warning' },
  { label: 'Trusted', min: 100, tone: 'success' },
  { label: 'Regular', min: 25, tone: 'info' },
  { label: 'New', min: 0, tone: 'muted' },
];

export function karmaTier(karma: number): KarmaTier {
  return TIERS.find((tier) => karma >= tier.min) ?? TIERS[TIERS.length - 1];
}

export function karmaColors(colors: AppColors, karma: number) {
  const { tone } = karmaTier(karma);
  if (tone === 'muted') return { bg: colors.inset, text: colors.muted, border: colors.border };
  return colors.status[tone];
}

export const mapKarmaRow = (row: any): KarmaInfo => ({
  karma: row.karma ?? 0,
  plansHosted: row.plans_hosted ?? 0,
  plansHostedHappened: row.plans_hosted_happened ?? 0,
  guestsHosted: row.guests_hosted ?? 0,
  plansJoined: row.plans_joined ?? 0,
  crewCount: row.crew_count ?? 0,
  verified: Boolean(row.verified),
  timesRemoved: row.times_removed ?? 0,
  lateCancels: row.late_cancels ?? 0,
});
