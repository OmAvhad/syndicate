export interface ColorPalette {
  bg: string
  surface: string
  surfaceSubtle: string
  card: string
  cardHover: string
  border: string
  borderSubtle: string
  borderHover: string

  accent: string
  accentHover: string
  accentSoft: string
  accentBorder: string

  textPrimary: string
  textSecondary: string
  textMuted: string
  textInverse: string

  success: string
  successSoft: string
  danger: string
  dangerSoft: string
  warning: string
  warningSoft: string
}

export const darkColors: ColorPalette = {
  bg: '#0A0E0C',
  surface: '#141A16',
  surfaceSubtle: '#0F1411',
  card: '#161D18',
  cardHover: '#1B241E',
  border: '#222D25',
  borderSubtle: '#1A221C',
  borderHover: '#314236',

  accent: '#C6F36A',
  accentHover: '#D5F788',
  accentSoft: 'rgba(198, 243, 106, 0.14)',
  accentBorder: 'rgba(198, 243, 106, 0.35)',

  textPrimary: '#F3F4F6',
  textSecondary: '#C5CDC7',
  textMuted: '#8E9B90',
  textInverse: '#0A0E0C',

  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.15)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.15)',
  warning: '#EAB308',
  warningSoft: 'rgba(234, 179, 8, 0.15)',
}

export const lightColors: ColorPalette = {
  bg: '#F5F7F5',
  surface: '#FFFFFF',
  surfaceSubtle: '#ECF1EC',
  card: '#FFFFFF',
  cardHover: '#F8FAF8',
  border: '#D3DDD4',
  borderSubtle: '#E2EAE3',
  borderHover: '#B5C5B7',

  accent: '#3E730B',
  accentHover: '#325D08',
  accentSoft: 'rgba(62, 115, 11, 0.12)',
  accentBorder: 'rgba(62, 115, 11, 0.32)',

  textPrimary: '#111612',
  textSecondary: '#364239',
  textMuted: '#647368',
  textInverse: '#FFFFFF',

  success: '#16A34A',
  successSoft: 'rgba(22, 163, 74, 0.12)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.12)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.12)',
}

export const commonMetrics = {
  borderRadius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  touchTarget: {
    minHeight: 48,
    minWidth: 48,
  },
}

export const theme = {
  colors: darkColors,
  ...commonMetrics,
}
