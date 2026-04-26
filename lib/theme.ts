export const colors = {
  page: '#F4F7F6',
  card: '#FFFFFF',
  text: '#222832',
  muted: '#737D8C',
  border: '#E6ECEF',
  primary: '#5BC4FF',
  secondary: '#F5A623',
  sky: '#B4E5FF',
  skyDark: '#1C4E6E',
  mint: '#D9F1EA',
  lavender: '#EDE6FF',
  peach: '#FFE2C7',
  butter: '#FFE6A7',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#FB7185',
  overlay: 'rgba(12, 18, 38, 0.45)',
};

export const gradients = {
  hero: ['#FFFFFF', '#F1FBFC'] as const,
  softHero: ['#FFFFFF', '#F6FCFF'] as const,
  amber: ['#8BD7FF', '#5BC4FF'] as const,
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
    shadowColor: '#C9D8DE',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  lift: {
    shadowColor: '#B7CBD4',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
};
