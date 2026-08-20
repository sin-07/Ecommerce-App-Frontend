export const colors = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  cardAlt: '#F1F5F9',
  navy: '#0F172A',
  primary: '#1D4ED8',
  primaryPressed: '#1E40AF',
  primaryLight: '#EFF6FF',
  accent: '#0284C7',
  citrus: '#F59E0B',
  success: '#10B981',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  danger: '#EF4444',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  white: '#FFFFFF',
  infoSurface: '#EFF6FF',
  infoBorder: '#BFDBFE',
  successSurface: '#ECFDF5',
  successBorder: '#A7F3D0',
  warningSurface: '#FFFBEB',
  warningBorder: '#FDE68A',
  dangerSurface: '#FEF2F2',
  dangerBorder: '#FECACA',
  darkHero: '#0B1220',
  eggAccent: '#D97706',
  eggSurface: '#FEF3C7',
  eggBorder: '#FDE68A',
  bevAccent: '#0284C7',
  bevSurface: '#E0F2FE',
  bevBorder: '#BAE6FD',
  wholesaleAccent: '#475569',
  wholesaleSurface: '#F1F5F9',
  wholesaleBorder: '#E2E8F0'
};

export const spacing = {
  x05: 4,
  x1: 8,
  x15: 12,
  x2: 16,
  x25: 20,
  x3: 24,
  x4: 32,
  x5: 40
} as const;

export const typeScale = {
  display: 28,
  title: 22,
  subtitle: 16,
  body: 14,
  label: 13,
  small: 11,
  caption: 10
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999
} as const;

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  floating: {
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  modal: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  }
} as const;

export const animation = {
  fast: 150,
  normal: 250,
  slow: 350
} as const;
