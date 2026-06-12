export type FreeGame = {
  appid: number;
  name: string;
  type?: string;
  header?: string;
  capsule?: string;
  until?: number;
};

export type PanelSide = 'left' | 'right';
export type TabStyle  = 'slim' | 'large' | 'floating';
export type FilterMode = 'games' | 'all' | 'weekend';
