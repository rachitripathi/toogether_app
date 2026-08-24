export type StatusToken = { bg: string; text: string; border: string };

export type AppColors = {
  page: string;
  card: string;
  surface: string;
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
  status: {
    success: StatusToken;
    warning: StatusToken;
    danger: StatusToken;
    info: StatusToken;
  };
};

export const lightColors: AppColors = {
  page: '#FFFFFF',
  card: '#FFFFFF',
  surface: '#F6F7FB',
  text: '#1A1D2E',
  muted: '#6B7490',
  border: '#E2E8F5',
  primary: '#5D7FFF',
  secondary: '#F5A623',
  sky: '#B4E5FF',
  skyDark: '#1C4E6E',
  mint: '#D9F1EA',
  lavender: '#EDE6FF',
  peach: '#FFE2C7',
  butter: '#FFE6A7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#FB7185',
  overlay: 'rgba(12, 18, 38, 0.52)',
  status: {
    success: { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
    warning: { bg: '#FFF7E8', text: '#B45309', border: '#FDE7B3' },
    danger: { bg: '#FFE4E6', text: '#E11D48', border: '#FECDD3' },
    info: { bg: '#EFF6FF', text: '#5D7FFF', border: '#DBEAFE' },
  },
};

// Dark palette isn't just light-with-inverted-lightness: text/status colors are bumped a
// notch brighter than their light-mode counterparts (WCAG needs more luminance contrast
// for colored text/icons on a dark ground than on a white one), and tint chips move from
// pale washes to low-opacity overlays of the same hue rather than flat pastel fills.
// card is deliberately the lightest of the three neutrals (page < surface < card),
// mirroring light mode where card (#FFFFFF) is lighter than surface (#F6F7FB) — that's
// what makes an active segment/pill/header/modal sheet visibly "pop" off of whatever
// it's sitting on, dark or light. Getting this order backwards (card darker than
// surface) is what made things like the auth screen's active Login/Sign Up pill nearly
// invisible against its own track in dark mode.
export const darkColors: AppColors = {
  page: '#0B0D14',
  surface: '#171B26',
  card: '#242A3B',
  text: '#F3F4F8',
  muted: '#9AA0B4',
  border: '#2A2F3D',
  primary: '#7B96FF',
  secondary: '#F5A623',
  sky: '#123549',
  skyDark: '#B4E5FF',
  mint: '#0F2E27',
  lavender: '#241E42',
  peach: '#3A2A1C',
  butter: '#332B14',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB8B98',
  overlay: 'rgba(0, 0, 0, 0.68)',
  status: {
    success: { bg: 'rgba(52, 211, 153, 0.16)', text: '#4ADE80', border: 'rgba(52, 211, 153, 0.32)' },
    warning: { bg: 'rgba(251, 191, 36, 0.14)', text: '#FBBF24', border: 'rgba(251, 191, 36, 0.32)' },
    danger: { bg: 'rgba(251, 139, 152, 0.16)', text: '#FCA5AE', border: 'rgba(251, 139, 152, 0.32)' },
    info: { bg: 'rgba(123, 150, 255, 0.16)', text: '#9DB2FF', border: 'rgba(123, 150, 255, 0.32)' },
  },
};

export type AppGradients = {
  hero: readonly [string, string];
  softHero: readonly [string, string];
  amber: readonly [string, string];
  verified: readonly [string, string];
};

export const lightGradients: AppGradients = {
  hero: ['#FFFFFF', '#EFF6FF'],
  softHero: ['#FFFFFF', '#F6FCFF'],
  amber: ['#7BBFFF', '#4F8EFF'],
  verified: ['#065F46', '#10B981'],
};

export const darkGradients: AppGradients = {
  hero: ['#0B0D14', '#121A2E'],
  softHero: ['#0B0D14', '#101826'],
  amber: ['#3D5FCC', '#7B96FF'],
  verified: ['#065F46', '#10B981'],
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
    shadowColor: '#C7D3F0',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  lift: {
    shadowColor: '#9AACDF',
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
