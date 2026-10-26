// ─── Globus Spirits App Theme ────────────────────────────────────────────────
// Royal blue + antique gold on warm cream neutrals (premium spirits feel).
// 60-30-10: ~60% Ivory/White, ~30% Royal Blue, ~10% Gold. Use gold sparingly.
// Readability: never set Antique Gold text on white (use Bronze Gold or Royal
// Blue); text on gold buttons is Deep Navy; gold text on Royal Blue/Navy is fine.

export const Palette = {
  // Brand
  royalBlue: '#1E3A8A',   // app bar, primary buttons, key headers
  deepNavy: '#13265C',    // pressed states, status bar, dark surfaces
  crestBlue: '#3B5BB5',   // links, selected tabs, highlights, info
  antiqueGold: '#C9A24D', // CTAs, icons, badges, dividers
  bronzeGold: '#A67C2E',  // gold text on light backgrounds, pressed state
  champagne: '#E8D5A3',   // chips, subtle highlights, borders
  // Neutrals (warm)
  ivory: '#FBF8F1',       // app background
  white: '#FFFFFF',       // cards, sheets
  parchment: '#F1EADB',   // section backgrounds, input fields
  stone: '#D9D2C3',       // dividers, borders
  taupe: '#7A7266',       // secondary text
  charcoal: '#1F1D1A',    // primary text
  // Status (toned down for the brand)
  success: '#2E7D5B',
  warning: '#D08C1F',
  error: '#B3261E',
  info: '#3B5BB5',
};

// Dark mode (the app currently ships light-only; kept for when it is enabled).
export const DarkPalette = {
  background: '#0E1430',  // navy-black
  surface: '#18204A',
  text: '#F5EFE0',
  textSecondary: '#B8B0A0',
  gold: '#D4AF5F',        // slightly brighter so it stands out on dark
};

// Hero banner / splash gradient: Deep Navy -> Royal Blue, with a gold line on top.
export const Gradients = {
  hero: ['#13265C', '#1E3A8A'],
  gold: ['#C9A24D', '#A67C2E'],
};

// Display font (serif, headings) - bundled in android/app/src/main/assets/fonts.
export const Fonts = {
  display: 'PlayfairDisplay_700Bold',
  displaySemi: 'PlayfairDisplay_600SemiBold',
};

export const Colors = {
  // ── Brand ────────────────────────────────────────────────────────────────
  primary: Palette.antiqueGold,        // gold accent (buttons, icons, CTAs)
  primaryDark: Palette.bronzeGold,     // pressed / gold text on light
  primaryLight: Palette.champagne,     // soft gold
  primaryUltraLight: Palette.parchment, // pale wash (chips, selected rows)

  // ── Neutrals ─────────────────────────────────────────────────────────────
  white: Palette.white,
  background: Palette.ivory,
  surfaceCard: Palette.white,
  border: Palette.stone,
  divider: Palette.parchment,

  // Dark surfaces (headers, tab bar, hero panels)
  ink: Palette.royalBlue,              // headers
  inkElevated: Palette.deepNavy,
  inkMuted: Palette.deepNavy,

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary: Palette.charcoal,
  textSecondary: Palette.taupe,
  textDisabled: '#ABA79C',
  textOnRed: Palette.deepNavy,         // text on the gold primary (name kept for compat)
  textOnDark: Palette.ivory,

  // ── Status / Semantic ────────────────────────────────────────────────────
  success: Palette.success,
  warning: Palette.warning,
  info: Palette.info,
  error: Palette.error,

  // ── Shadows ──────────────────────────────────────────────────────────────
  shadowRed: 'rgba(201, 162, 77, 0.30)',   // gold glow (name kept for compat)
  shadowNeutral: 'rgba(19, 38, 92, 0.12)',
};

export const Typography = {
  // Sizes
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,

  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Elevation = {
  card: {
    shadowColor: Colors.shadowNeutral,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBar: {
    shadowColor: Colors.shadowNeutral,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 20,
  },
  fab: {
    shadowColor: Colors.shadowRed,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 18,
  },
  modal: {
    shadowColor: 'rgba(0,0,0,0.22)',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 32,
  },
  header: {
    shadowColor: Colors.shadowNeutral,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
};

const theme = { Colors, Typography, Spacing, Radius, Elevation };
export default theme;
