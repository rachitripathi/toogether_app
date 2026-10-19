export type StatusToken = { bg: string; text: string; border: string };

export type AppColors = {
  page: string;
  card: string;
  surface: string;
  // Soft fill for things sitting *inside* a white card or list (segmented-control tracks,
  // small chips, stat cells), so they don't vanish white-on-white.
  inset: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  secondary: string;
  sky: string;
  skyDark: string;
  mint: string;
  lavender: string;
  peach: string;
  butter: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
  // Verified tick: the familiar social-app blue, deliberately not the brand orange.
  verified: string;
  // Light wash of `verified` behind blue verification chips.
  verifiedTint: string;
  // Solid fills for accept / decline / remove buttons, always with white text. The
  // status.*.bg tints are translucent washes in dark mode and read as see-through buttons.
  solid: { accept: string; decline: string };
  // Fill for a card that needs the user's attention (e.g. pending join requests). Strong enough
  // to stand apart from the page without an outline; page and card are both white in light mode.
  attention: string;
  status: {
    success: StatusToken;
    warning: StatusToken;
    danger: StatusToken;
    info: StatusToken;
  };
};

export const lightColors: AppColors = {
  // Warm off-white page; cards, inputs and lists are white on top of it so they pop.
  page: '#F9F7F2',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  inset: '#F1ECE2',
  text: '#1A1D2E',
  muted: '#726D66',
  border: '#ECE6DB',
  primary: '#FF6A00',
  secondary: '#7C8CFF',
  sky: '#FFE4D1',
  skyDark: '#C2410C',
  mint: '#D9F1EA',
  lavender: '#EDE6FF',
  peach: '#FFE2C7',
  butter: '#FFE6A7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#FB7185',
  overlay: 'rgba(12, 18, 38, 0.52)',
  verified: '#0095F6',
  verifiedTint: 'rgba(0, 149, 246, 0.12)',
  solid: { accept: '#16A34A', decline: '#DC2626' },
  attention: '#FFF3C4',
  status: {
    success: { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
    warning: { bg: '#FEF9C3', text: '#A16207', border: '#FDE68A' },
    danger: { bg: '#FFE4E6', text: '#E11D48', border: '#FECDD3' },
    info: { bg: '#FFF1E6', text: '#E05A00', border: '#FFD9BF' },
  },
};

// Dark palette isn't just light-with-inverted-lightness: text/status colors are bumped a
// notch brighter than their light-mode counterparts (WCAG needs more luminance contrast
// for colored text/icons on a dark ground than on a white one), and tint chips move from
// pale washes to low-opacity overlays of the same hue rather than flat pastel fills.
// card is deliberately the lightest neutral (page < surface < inset < card). That's what
// makes an active segment/pill/header/modal sheet visibly "pop" off whatever it's sitting
// on. Segmented-control tracks use `inset` and the active segment `card`, in both themes
// (light mode: warm #F1ECE2 track, white segment). Getting this order backwards (card
// darker than its track) is what made the auth screen's active Login/Sign Up pill nearly
// invisible in dark mode.
export const darkColors: AppColors = {
  page: '#0B0D14',
  surface: '#171B26',
  inset: '#1F2433',
  card: '#242A3B',
  text: '#F3F4F8',
  muted: '#9AA0B4',
  border: '#2A2F3D',
  primary: '#FF7A1A',
  secondary: '#9AA6FF',
  sky: '#3A2414',
  skyDark: '#FFB380',
  mint: '#0F2E27',
  lavender: '#241E42',
  peach: '#3A2A1C',
  butter: '#332B14',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB8B98',
  overlay: 'rgba(0, 0, 0, 0.68)',
  verified: '#1DA1F2',
  verifiedTint: 'rgba(29, 161, 242, 0.18)',
  solid: { accept: '#16A34A', decline: '#DC2626' },
  attention: '#3A2C12',
  status: {
    success: { bg: 'rgba(52, 211, 153, 0.16)', text: '#4ADE80', border: 'rgba(52, 211, 153, 0.32)' },
    warning: { bg: 'rgba(251, 191, 36, 0.14)', text: '#FBBF24', border: 'rgba(251, 191, 36, 0.32)' },
    danger: { bg: 'rgba(251, 139, 152, 0.16)', text: '#FCA5AE', border: 'rgba(251, 139, 152, 0.32)' },
    info: { bg: 'rgba(255, 122, 26, 0.16)', text: '#FFA066', border: 'rgba(255, 122, 26, 0.32)' },
  },
};

export type AppGradients = {
  hero: readonly [string, string];
  softHero: readonly [string, string];
  amber: readonly [string, string];
  verified: readonly [string, string];
  // Brand orange, matching the Open Plans logo gradient (FAB, onboarding CTA).
  brand: readonly [string, string];
  // Subtle diagonal on orange CTA buttons (GradientButton, CtaFill): visible, not loud.
  cta: readonly [string, string];
  // Orange → light orange on the tab headers and other orange hero bars.
  header: readonly [string, string];
};

export const lightGradients: AppGradients = {
  hero: ['#F9F7F2', '#FFF0E2'],
  softHero: ['#F9F7F2', '#FDF4EA'],
  amber: ['#FFB067', '#FF6A00'],
  verified: ['#065F46', '#10B981'],
  brand: ['#FF9C56', '#FF6A00'],
  cta: ['#FF9248', '#FF6A00'],
  header: ['#FF6A00', '#FFA463'],
};

export const darkGradients: AppGradients = {
  hero: ['#0B0D14', '#1A1410'],
  softHero: ['#0B0D14', '#15110E'],
  amber: ['#C24E00', '#FF7A1A'],
  verified: ['#065F46', '#10B981'],
  brand: ['#FF9C56', '#FF6A00'],
  cta: ['#FFA060', '#FF7A1A'],
  header: ['#E85F00', '#FF8F45'],
};

export const spacing = {
  screen: 20,
  card: 16,
};

export const radius = {
  sm: 14,
  md: 20,
  lg: 28,
  pill: 999,
};

export type AppShadow = typeof lightShadow;

export const lightShadow = {
  card: {
    shadowColor: '#EBD3C2',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  lift: {
    shadowColor: '#E8A57A',
    shadowOpacity: 0.26,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  compact: {
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
};

// Shadows read as soft colored glows in light mode, but that same technique just looks
// like a grey smear on a dark background — dark mode shadows stay pure black and much
// more subtle, leaning on `elevation` (Android) more than blur to separate surfaces.
export const darkShadow: AppShadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  lift: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  compact: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
};
