import React, { useState, useEffect, useRef } from 'react';
import { HsvPicker } from './hsv-picker';

const h = React.createElement;

export interface PluginSettings {
  autoAdd: boolean;
  pollIntervalMin: number;
  notifyOnly: boolean;
  notifyOnGrab: boolean;
}

export interface WidgetSettings {
  panelSide:   'left' | 'right';
  tabColor:    string;
  accentColor: string;
  showOverlay: boolean;
  tabStyle:    'slim' | 'large' | 'floating';
}

interface Swatch { id: string; label: string; preview: string }
const COLOR_SWATCHES: Swatch[] = [
  { id: 'gray',  label: 'Gray',  preview: 'rgba(255,255,255,0.35)' },
  { id: 'black', label: 'Black', preview: 'rgba(0,0,0,0.85)'       },
  { id: 'white', label: 'White', preview: 'rgba(255,255,255,0.92)' },
  { id: 'blue',  label: 'Blue',  preview: 'rgb(76,158,255)'        },
  { id: 'red',   label: 'Red',   preview: 'rgb(224,82,82)'         },
];

const STYLE_OPTIONS = [
  { id: 'slim',     label: 'Slim'     },
  { id: 'large',    label: 'Large'    },
  { id: 'floating', label: 'Floating' },
];

const WIDGET_LS_KEY = 'fgg_widget_settings';

const widgetDefaults = (): WidgetSettings => ({
  panelSide:   'left',
  tabColor:    'gray',
  accentColor: 'rgba(255,255,255,0.5)',
  showOverlay: false,
  tabStyle:    'large',
});

export function loadWidgetSettings(): WidgetSettings {
  const base = widgetDefaults();
  try {
    const raw = localStorage.getItem(WIDGET_LS_KEY);
    if (!raw) return base;
    return Object.assign(base, JSON.parse(raw));
  } catch {
    return base;
  }
}

export function saveWidgetSettings(s: WidgetSettings) {
  try {
    localStorage.setItem(WIDGET_LS_KEY, JSON.stringify(s));
  } catch {}
}

type Choice = { id: string; label: string };

interface DropdownProps {
  label:    string;
  items:    Choice[];
  selected: string;
  onSelect: (id: string) => void;
}

const Dropdown: React.FC<DropdownProps> = (props) => {
  const { label, items, selected, onSelect } = props;
  const [open, setOpen] = useState(false);

  const triggerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
    borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.07)', cursor: 'pointer',
    color: '#fff', fontSize: 12, minWidth: 110,
    justifyContent: 'space-between',
    outline: 'none',
  };

  const caret = h('svg',
    { width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none' },
    h('polyline', {
      points: open ? '1,7 5,3 9,7' : '1,3 5,7 9,3',
      stroke: 'rgba(255,255,255,0.5)', strokeWidth: '1.5',
      strokeLinecap: 'round', strokeLinejoin: 'round',
    }),
  );

  const trigger = h('button',
    { onClick: () => setOpen((v) => !v), style: triggerStyle },
    h('span', null, label),
    caret,
  );

  if (!open) {
    return h('div', { style: { position: 'relative' } }, trigger);
  }

  const overlay = h('div', {
    onClick: () => setOpen(false),
    style: { position: 'fixed', inset: 0, zIndex: 9998 },
  });

  const menu = h('div', {
    style: {
      position: 'absolute', right: 0, top: '110%', zIndex: 9999,
      background: '#2a3547', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, overflow: 'hidden', minWidth: 120,
    },
  }, ...items.map((item) => {
    const active = item.id === selected;
    return h('button', {
      key: item.id,
      onClick: () => { onSelect(item.id); setOpen(false); },
      style: {
        display: 'block', width: '100%', padding: '9px 14px',
        border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12,
        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
        color:      active ? '#fff' : 'rgba(255,255,255,0.7)',
        fontWeight: active ? 700 : 400,
      },
    }, item.label);
  }));

  return h('div', { style: { position: 'relative' } }, trigger, overlay, menu);
};

interface ColorDropdownProps {
  selected: string;
  preview:  string;
  label:    string;
  active:   boolean;
  items:    Swatch[];
  onSelect: (id: string) => void;
}

const ColorDropdown: React.FC<ColorDropdownProps> = (props) => {
  const { selected, preview, label, items, onSelect } = props;
  const [open, setOpen] = useState(false);

  const triggerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 8px',
    borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.07)', cursor: 'pointer',
    color: '#fff', fontSize: 12, minWidth: 110,
    justifyContent: 'space-between',
    outline: 'none',
  };

  const dot = h('span', {
    style: {
      width: 14, height: 14, borderRadius: '50%',
      background: preview,
      boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
      flexShrink: 0,
    },
  });

  const caret = h('svg',
    { width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none' },
    h('polyline', {
      points: open ? '1,7 5,3 9,7' : '1,3 5,7 9,3',
      stroke: 'rgba(255,255,255,0.5)', strokeWidth: '1.5',
      strokeLinecap: 'round', strokeLinejoin: 'round',
    }),
  );

  const trigger = h('button',
    { onClick: (e: React.MouseEvent) => { e.stopPropagation(); setOpen((v) => !v); }, style: triggerStyle },
    h('span', { style: { display: 'flex', alignItems: 'center', gap: 8 } }, dot, h('span', null, label)),
    caret,
  );

  if (!open) {
    return h('div', { style: { position: 'relative' } }, trigger);
  }

  const overlay = h('div', {
    onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); },
    style: { position: 'fixed', inset: 0, zIndex: 9998 },
  });

  const menu = h('div', {
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    style: {
      position: 'absolute', right: 0, top: '110%', zIndex: 9999,
      background: '#2a3547', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, overflow: 'hidden', minWidth: 140,
    },
  }, ...items.map((item) => {
    const isActive = item.id === selected;
    return h('button', {
      key: item.id,
      onClick: () => { onSelect(item.id); setOpen(false); },
      style: {
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 12px',
        border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12,
        background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        color:      isActive ? '#fff' : 'rgba(255,255,255,0.8)',
        fontWeight: isActive ? 700 : 400,
      },
    },
      h('span', {
        style: {
          width: 14, height: 14, borderRadius: '50%',
          background: item.preview,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
          flexShrink: 0,
        },
      }),
      h('span', null, item.label),
    );
  }));

  return h('div', { style: { position: 'relative' } }, trigger, overlay, menu);
};

interface ColorPickerProps {
  value:    string;
  onChange: (v: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  const isCustom = value.charAt(0) === '#';
  const [open, setOpen] = useState(false);
  const [customHex, setCustomHex] = useState<string>(isCustom ? value : '#4c9eff');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const swatchBase: React.CSSProperties = {
    width: 22, height: 22, borderRadius: '50%',
    cursor: 'pointer', flexShrink: 0, padding: 0,
    transition: 'transform 0.15s, box-shadow 0.15s',
  };

  const ring = (_active: boolean): React.CSSProperties => ({
    boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
  });

  const selectedPreset = COLOR_SWATCHES.find((s) => s.id === value);
  const triggerLabel   = selectedPreset ? selectedPreset.label : 'Custom';
  const triggerPreview = selectedPreset ? selectedPreset.preview : (isCustom ? customHex : 'rgba(255,255,255,0.15)');

  const presetDropdown = h(ColorDropdown, {
    selected: value,
    preview:  triggerPreview,
    label:    triggerLabel,
    active:   !!selectedPreset,
    items:    COLOR_SWATCHES,
    onSelect: (id: string) => { setOpen(false); onChange(id); },
  });

  const paletteIcon = h('svg', {
    width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  },
    h('circle', { cx: 13.5, cy: 6.5, r: 0.5, fill: 'currentColor' }),
    h('circle', { cx: 17.5, cy: 10.5, r: 0.5, fill: 'currentColor' }),
    h('circle', { cx: 8.5,  cy: 7.5,  r: 0.5, fill: 'currentColor' }),
    h('circle', { cx: 6.5,  cy: 12.5, r: 0.5, fill: 'currentColor' }),
    h('path', { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z' }),
  );

  const paletteBtn = h('button', {
    key: 'custom',
    title: isCustom ? `Custom (${customHex})` : 'Custom color',
    onClick: () => setOpen((v) => !v),
    style: {
      ...swatchBase,
      background: isCustom ? customHex : 'rgba(255,255,255,0.08)',
      color: isCustom ? '#fff' : 'rgba(255,255,255,0.75)',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
      ...ring(isCustom || open),
    },
  }, paletteIcon);

  const grid = h('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'end',
    },
  }, presetDropdown, paletteBtn);

  const popover = open ? h('div', {
    style: {
      position: 'absolute',
      top: 'calc(100% + 10px)',
      right: 0,
      zIndex: 10000,
    },
  }, h(HsvPicker, {
    value: isCustom ? value : customHex,
    onChange: (hex: string) => {
      setCustomHex(hex);
      onChange(hex);
    },
  })) : null;

  return h('div', {
    ref: wrapRef,
    style: { position: 'relative' },
  }, grid, popover);
};

interface ToggleProps {
  value:    boolean;
  onChange: (v: boolean) => void;
}

const ToggleBtn: React.FC<ToggleProps> = ({ value, onChange }) => {
  const trackStyle: React.CSSProperties = {
    width: 44, height: 24, borderRadius: 12, border: 'none',
    cursor: 'pointer', flexShrink: 0,
    background: value
      ? 'linear-gradient(135deg,#55cc55,#2a8a2a)'
      : 'rgba(255,255,255,0.15)',
    position: 'relative', transition: 'background 0.2s',
  };

  const knobStyle: React.CSSProperties = {
    position: 'absolute', top: 4, width: 16, height: 16,
    borderRadius: '50%', background: 'white',
    transition: 'left 0.2s', left: value ? 24 : 4,
  };

  return h(
    'button',
    { onClick: () => onChange(!value), style: trackStyle },
    h('span', { style: knobStyle }),
  );
};

function row(title: string, desc: string, control: React.ReactNode, first = false) {
  return h('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
      borderTop: first ? 'none' : '1px solid rgba(255,255,255,0.06)',
    },
  },
    h('div', null,
      h('div', { style: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 } }, title),
      h('div', { style: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 } }, desc),
    ),
    control,
  );
}

interface SettingsTabProps {
  plugin:   PluginSettings;
  widget:   WidgetSettings;
  onPlugin: (p: Partial<PluginSettings>) => void;
  onWidget: (p: Partial<WidgetSettings>) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ widget, onWidget }) => {
  const resetBtn = h('button', {
    onClick: () => onWidget(widgetDefaults()),
    title: 'Reset to defaults',
    style: {
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 10px', borderRadius: 6,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.55)', fontSize: 11,
      cursor: 'pointer', marginBottom: 10,
    },
  },
    h('svg', {
      width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2.2,
      strokeLinecap: 'round', strokeLinejoin: 'round',
    },
      h('path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
      h('path', { d: 'M3 3v5h5' }),
    ),
    'Reset to defaults',
  );

  const heading = h('div', { style: { paddingBottom: 8 } },
    h('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      },
    },
      h('div', {
        style: {
          color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        },
      }, 'Store Page Widget'),
      resetBtn,
    ),
  );

  const overlayRow = row(
    'Background Overlay',
    'Dim the screen when panel is open',
    h(ToggleBtn, {
      value: widget.showOverlay,
      onChange: (v) => onWidget({ showOverlay: v }),
    }),
    true,
  );

  const colorRow = row(
    'Button Color',
    'Pick a preset or choose any custom color',
    h(ColorPicker, {
      value:    widget.tabColor,
      onChange: (id) => onWidget({ tabColor: id }),
    }),
  );

  const accentRow = row(
    'Accent Color',
    'Color of tabs, highlights and active elements',
    h(ColorPicker, {
      value:    widget.accentColor ?? 'rgba(255,255,255,0.5)',
      onChange: (id) => onWidget({ accentColor: id }),
    }),
  );

  const sideRow = row(
    'Panel Side',
    'Side the panel slides out from',
    h(Dropdown, {
      label:    widget.panelSide === 'left' ? 'Left' : 'Right',
      items:    [{ id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }],
      selected: widget.panelSide,
      onSelect: (id) => onWidget({ panelSide: id as 'left' | 'right' }),
    }),
  );

  const styleRow = row(
    'Button Style',
    'Shape of the side tab button',
    h(Dropdown, {
      label:    STYLE_OPTIONS.find((s) => s.id === widget.tabStyle)?.label || 'Slim',
      items:    STYLE_OPTIONS,
      selected: widget.tabStyle,
      onSelect: (id) => onWidget({ tabStyle: id as WidgetSettings['tabStyle'] }),
    }),
  );

  return h('div',
    { style: { display: 'flex', flexDirection: 'column' } },
    heading, overlayRow, colorRow, accentRow, sideRow, styleRow,
  );
};
