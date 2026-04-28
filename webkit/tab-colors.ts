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

export function getTabColor(id: string): TabColor {
  return palette[id] || palette.gray;
}
