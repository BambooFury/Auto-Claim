import french from './languages/french.json';
import german from './languages/german.json';
import italian from './languages/italian.json';
import japanese from './languages/japanese.json';
import latam from './languages/latam.json';
import polish from './languages/polish.json';
import russian from './languages/russian.json';
import schinese from './languages/schinese.json';
import spanish from './languages/spanish.json';
import ukrainian from './languages/ukrainian.json';

const TABLE: Record<string, Record<string, string>> = {
  french,
  german,
  italian,
  japanese,
  latam,
  polish,
  russian,
  schinese,
  spanish,
  ukrainian,
};

const LOCALES: Record<string, string> = {
  french: 'fr-FR',
  german: 'de-DE',
  italian: 'it-IT',
  japanese: 'ja-JP',
  latam: 'es-419',
  polish: 'pl-PL',
  russian: 'ru-RU',
  schinese: 'zh-CN',
  spanish: 'es-ES',
  ukrainian: 'uk-UA',
};

const LANG = (() => {
  try {
    return (new URLSearchParams(window.location.search).get('LANGUAGE') ?? 'english').toLowerCase();
  } catch {
    return 'english';
  }
})();

let localized = true;
let version = 0;
const listeners = new Set<() => void>();

export function setLocalizationEnabled(v: boolean): void {
  if (localized === v) return;
  localized = v;
  version++;
  for (const fn of Array.from(listeners)) fn();
}

export function getLocalizationVersion(): number {
  return version;
}

export function subscribeLocalization(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function currentLocale(): string {
  return LOCALES[LANG] ?? 'en-US';
}

export function t(s: string, vars?: Record<string, string | number>): string {
  let out = localized ? (TABLE[LANG]?.[s] ?? s) : s;
  if (vars) {
    for (const k in vars) out = out.replace(`{${k}}`, String(vars[k]));
  }
  return out;
}
