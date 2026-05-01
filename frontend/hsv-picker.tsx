import React, { useState, useEffect, useRef, useCallback } from 'react';

const h = React.createElement;
export interface HSV { h: number; s: number; v: number }
export interface RGB { r: number; g: number; b: number }

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh >= 0 && hh < 1) { r = c; g = x; b = 0; }
  else if (hh < 2)       { r = x; g = c; b = 0; }
  else if (hh < 3)       { r = 0; g = c; b = x; }
  else if (hh < 4)       { r = 0; g = x; b = c; }
  else if (hh < 5)       { r = x; g = 0; b = c; }
  else                   { r = c; g = 0; b = x; }
  const m = v - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === rn)      hue = ((gn - bn) / d) % 6;
    else if (max === gn) hue = (bn - rn) / d + 2;
    else                 hue = (rn - gn) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: hue, s, v: max };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return '#' + to2(r) + to2(g) + to2(b);
}

export function hexToRgb(hex: string): RGB | null {
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
interface HsvPickerProps {
  value:    string;
  onChange: (hex: string) => void;
}

export const HsvPicker: React.FC<HsvPickerProps> = ({ value, onChange }) => {
  const initRgb = hexToRgb(value) || { r: 76, g: 158, b: 255 };
  const initHsv = rgbToHsv(initRgb.r, initRgb.g, initRgb.b);

  const [hsv, setHsv]       = useState<HSV>(initHsv);
  const [hexText, setHexText] = useState<string>(value.charAt(0) === '#' ? value.toUpperCase() : rgbToHex(initRgb.r, initRgb.g, initRgb.b).toUpperCase());

  const svRef  = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const emit = useCallback((nextHsv: HSV) => {
    const rgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setHexText(hex.toUpperCase());
    onChange(hex);
  }, [onChange]);

  const onSvDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const update = (cx: number, cy: number) => {
      const s = clamp01((cx - rect.left) / rect.width);
      const v = 1 - clamp01((cy - rect.top) / rect.height);
      const next = { ...hsv, s, v };
      setHsv(next);
      emit(next);
    };

    update(e.clientX, e.clientY);

    const move = (ev: MouseEvent) => update(ev.clientX, ev.clientY);
    const up   = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onHueDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const update = (cx: number) => {
      const h = clamp01((cx - rect.left) / rect.width) * 360;
      const next = { ...hsv, h };
      setHsv(next);
      emit(next);
    };

    update(e.clientX);

    const move = (ev: MouseEvent) => update(ev.clientX);
    const up   = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const onHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.toUpperCase();
    if (raw.charAt(0) !== '#') raw = '#' + raw;
    setHexText(raw);
    const rgb = hexToRgb(raw);
    if (rgb) {
      const nextHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      if (nextHsv.s === 0) nextHsv.h = hsv.h;
      setHsv(nextHsv);
      onChange(raw.toLowerCase());
    }
  };
  useEffect(() => {
    if (value.charAt(0) === '#' && value.toUpperCase() !== hexText) {
      setHexText(value.toUpperCase());
      const rgb = hexToRgb(value);
      if (rgb) setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    }
  }, [value]);

  const hueColor = rgbToHex(
    hsvToRgb(hsv.h, 1, 1).r,
    hsvToRgb(hsv.h, 1, 1).g,
    hsvToRgb(hsv.h, 1, 1).b,
  );

  const currentRgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const currentHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);

  const svQuad = h('div', {
    ref: svRef,
    onMouseDown: onSvDown,
    style: {
      position: 'relative',
      width: '100%',
      height: 140,
      borderRadius: 6,
      cursor: 'crosshair',
      background: `
        linear-gradient(to top, #000, rgba(0,0,0,0)),
        linear-gradient(to right, #fff, ${hueColor})
      `,
    },
  }, h('div', {
    style: {
      position: 'absolute',
      left: `${hsv.s * 100}%`,
      top:  `${(1 - hsv.v) * 100}%`,
      width: 14, height: 14,
      border: '2px solid #fff',
      borderRadius: '50%',
      transform: 'translate(-50%, -50%)',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
    },
  }));

  const hueSlider = h('div', {
    ref: hueRef,
    onMouseDown: onHueDown,
    style: {
      position: 'relative',
      width: '100%',
      height: 12,
      borderRadius: 6,
      cursor: 'pointer',
      background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
    },
  }, h('div', {
    style: {
      position: 'absolute',
      left: `${(hsv.h / 360) * 100}%`,
      top: '50%',
      width: 14, height: 14,
      border: '2px solid #fff',
      borderRadius: '50%',
      transform: 'translate(-50%, -50%)',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
    },
  }));

  const preview = h('div', {
    style: {
      width: 34, height: 34,
      borderRadius: '50%',
      background: currentHex,
      flexShrink: 0,
      boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
    },
  });

  const hexInput = h('input', {
    type: 'text',
    value: hexText,
    onChange: onHexChange,
    spellCheck: false,
    maxLength: 7,
    style: {
      flex: 1,
      height: 30,
      padding: '0 10px',
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 6,
      color: '#fff',
      fontSize: 13,
      fontFamily: 'monospace',
      letterSpacing: 0.5,
      outline: 'none',
    },
  });

  const bottomRow = h('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
  }, preview, hexInput);

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      width: 220,
      padding: 12,
      background: '#1a2230',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
    },
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  }, svQuad, hueSlider, bottomRow);
};
