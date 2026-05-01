export interface TabColor {
  bg: string;
  bgHover: string;
  arrow: string;
}

const palette: Record<string, TabColor> = {
  gray:  { bg: 'rgba(255,255,255,0.12)', bgHover: 'rgba(255,255,255,0.22)', arrow: 'rgba(255,255,255,0.7)' },
  black: { bg: 'rgba(0,0,0,0.75)',       bgHover: 'rgba(0,0,0,0.9)',        arrow: 'rgba(255,255,255,0.7)' },
  white: { bg: 'rgba(255,255,255,0.85)', bgHover: 'rgba(255,255,255,1)',    arrow: 'rgba(0,0,0,0.7)'       },
  blue:  { bg: 'rgba(76,158,255,0.7)',   bgHover: 'rgba(76,158,255,0.9)',   arrow: 'rgba(255,255,255,0.9)' },
  red:   { bg: 'rgba(224,82,82,0.7)',    bgHover: 'rgba(224,82,82,0.9)',    arrow: 'rgba(255,255,255,0.9)' },
};

export const TAB_COLORS = palette;

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function isLight(r: number, g: number, b: number): boolean {
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160;
}

export function hexToTabColor(hex: string): TabColor | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const { r, g, b } = rgb;
  const light = isLight(r, g, b);
  return {
    bg:      `rgba(${r},${g},${b},0.7)`,
    bgHover: `rgba(${r},${g},${b},0.9)`,
    arrow:   light ? 'rgba(20,20,20,0.8)' : 'rgba(255,255,255,0.9)',
  };
}

export function getTabColor(id: string): TabColor {
  if (!id) return palette.gray;
  if (id.charAt(0) === '#') {
    return hexToTabColor(id) || palette.gray;
  }
  return palette[id] || palette.gray;
}
