export interface FreeGame {
  appid:   number;
  name:    string;
  type?:   string;
  header?: string;
  capsule?: string;
}

export interface ScanHit {
  appid: number;
  name:  string;
  cc?:   string;
  fromGamerPower?: boolean;
}

export interface ScannerLogger {
  info(msg: string): void;
  warn(msg: string): void;
}

export const STORE_HOST     = 'https://store.steampowered.com';
export const SEARCH_BASE    = STORE_HOST + '/search/results/?specials=1&maxprice=free&json=1&count=50&l=english';
export const SEARCH_REGIONS = ['us', 'de', 'tr'] as const;
export const APPDETAILS_URL = STORE_HOST + '/api/appdetails';
