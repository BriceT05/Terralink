// Tokens de la charte graphique TerraLink v2.0 (voir Info/Terra-Link_Charte_Graphique_v2.pptx).

export const colors = {
  green: '#305C41',
  greenDark: '#234531',
  greenTint: '#E3ECE5',
  terracotta: '#B65F2E',
  terracottaDark: '#8C4A22',
  terracottaTint: '#F5E3D6',
  gold: '#DDA641',
  sand: '#F4EFE6',
  sand2: '#EAE1D2',
  charcoal: '#2B2A28',
  white: '#FFFFFF',
  border: '#D8CFC0',
  muted: '#6B675F',
  danger: '#A63A2B',
  dangerTint: '#F6DEDA',
} as const;

export const fonts = {
  title: 'Lora_700Bold',
  titleSemi: 'Lora_600SemiBold',
  body: 'Poppins_400Regular',
  bodyMedium: 'Poppins_500Medium',
  bodySemi: 'Poppins_600SemiBold',
} as const;

// Échelle mobile de la charte (colonne « mobile », < 768 px).
export const type = {
  h1: { fontFamily: fonts.title, fontSize: 40, lineHeight: 44 },
  h2: { fontFamily: fonts.title, fontSize: 30, lineHeight: 35 },
  h3: { fontFamily: fonts.titleSemi, fontSize: 22, lineHeight: 28 },
  h4: { fontFamily: fonts.titleSemi, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 17, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  button: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 20 },
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96 } as const;

export const radius = { s: 8, m: 16, pill: 999 } as const;

export const shadow = {
  s: { shadowColor: colors.charcoal, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  m: { shadowColor: colors.charcoal, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
} as const;

// Hauteur des éléments interactifs (charte : 48 px, cible tactile ≥ 44 px).
export const controlHeight = 48;
