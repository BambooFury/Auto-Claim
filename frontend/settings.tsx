import React, { useState } from 'react';

const h = React.createElement;

export interface PluginSettings {
  autoAdd: boolean;
  pollIntervalMin: number;
  notifyOnly: boolean;
  notifyOnGrab: boolean;
}

export interface WidgetSettings {
  panelSide:   'left' | 'right';
  tabColor:    'gray' | 'black' | 'white' | 'blue' | 'red';
  showOverlay: boolean;
  tabStyle:    'slim' | 'large' | 'floating';
}

const COLOR_OPTIONS = [
  { id: 'gray',  label: 'Gray'  },
  { id: 'black', label: 'Black' },
  { id: 'white', label: 'White' },
  { id: 'blue',  label: 'Blue'  },
  { id: 'red',   label: 'Red'   },
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
  const heading = h('div', { style: { paddingBottom: 8 } },
    h('div', {
      style: {
        color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
      },
    }, 'Store Page Widget'),
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
    'Color of the side tab button',
    h(Dropdown, {
      label:    COLOR_OPTIONS.find((c) => c.id === widget.tabColor)?.label || 'Gray',
      items:    COLOR_OPTIONS,
      selected: widget.tabColor,
      onSelect: (id) => onWidget({ tabColor: id as WidgetSettings['tabColor'] }),
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
    heading, overlayRow, colorRow, sideRow, styleRow,
  );
};
