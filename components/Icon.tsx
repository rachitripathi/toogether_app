import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '@/providers/ThemeProvider';
import { SOLAR_ICONS } from './solarIcons';

type IconProps = {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  // Bridges Ionicons (wants TextStyle) and SvgXml (wants ViewStyle) — callers pass
  // plain layout tweaks like { marginTop: 1 } that are valid under either type.
  style?: any;
};

// Drop-in replacement for Ionicons: renders the Solar icon set (svgrepo.com / Iconify,
// CC BY 4.0) for any glyph name we have a mapping for in solarIcons.ts, and transparently
// falls back to the original Ionicons glyph for anything not yet mapped (brand logos,
// bare checkmark, etc.) so callers never need special-casing.
export function Icon({ name, size = 20, color, style }: IconProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.text;
  const body = SOLAR_ICONS[name as string];
  if (!body) {
    return <Ionicons name={name} size={size} color={resolvedColor} style={style} />;
  }
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body.split('currentColor').join(resolvedColor)}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} style={style} />;
}
