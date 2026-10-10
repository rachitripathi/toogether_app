import type { AppColors } from '@/lib/theme';

// A person's rating is the average of the 1–5 stars others gave them after shared plans
// (getUserAverageRating). Color bands: 4.0+ green, 3.0–3.9 yellow, below 3.0 red.
export type RatingTone = 'success' | 'warning' | 'danger';

export function ratingTone(average: number): RatingTone {
  if (average >= 4) return 'success';
  if (average >= 3) return 'warning';
  return 'danger';
}

// Text color for an average, or muted for someone with no ratings yet.
export function ratingColor(colors: AppColors, average: number | null): string {
  return average ? colors.status[ratingTone(average)].text : colors.muted;
}

export function formatRating(average: number | null): string {
  return average ? average.toFixed(1) : 'New';
}
