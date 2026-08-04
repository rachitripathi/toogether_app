export const colors = {
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
};

export const gradients = {
  hero: ['#FFFFFF', '#EFF6FF'] as const,
  softHero: ['#FFFFFF', '#F6FCFF'] as const,
  amber: ['#7BBFFF', '#4F8EFF'] as const,
  crew: ['#6D28D9', '#5D7FFF'] as const,
  activity: ['#EA580C', '#FBBF24'] as const,
  profile: ['#0369A1', '#5D7FFF'] as const,
  verified: ['#065F46', '#10B981'] as const,
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

export const shadow = {
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
