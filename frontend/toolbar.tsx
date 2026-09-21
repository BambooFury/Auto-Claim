import { findModule } from 'millennium';
import React, { useSyncExternalStore } from 'react';
import { TbGift } from 'react-icons/tb';
import { openManager } from './manager';
import { logIPC } from './ipc';
import { getNewGamesCount, subscribeScanState } from './scanControl';

const log = (msg: string) => { logIPC({ payload: msg }).catch(() => {}); };

const MAIN_WINDOW_NAME = 'SP Desktop_uid0';
const CONTAINER_CLASS = 'autoclaim-toolbar-container';

const TOOLBAR_STYLES = `
.${CONTAINER_CLASS} {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
  order: 999;
  -webkit-app-region: no-drag;
}
.${CONTAINER_CLASS} * {
  -webkit-app-region: no-drag;
}
.autoclaim-toolbar-button {
  width: 34px;
  height: 34px;
  min-width: unset;
  padding: 2px;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 50%;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--main-text-color, inherit);
  transition: background 0.2s ease, border 0.2s ease;
}
.autoclaim-toolbar-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: gray;
}
.autoclaim-toolbar-button svg {
  display: block;
  opacity: 0.7;
}
.autoclaim-toolbar-button:hover svg {
  opacity: 1;
}
.autoclaim-toolbar-badge {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-online, #5dc26a);
  pointer-events: none;
}
.autoclaim-toolbar-badge.is-hidden {
  display: none;
}
`;

function ToolbarButton(): React.JSX.Element {
  const count = useSyncExternalStore(subscribeScanState, getNewGamesCount);
  return (
    <button type="button" className="autoclaim-toolbar-button" onClick={openManager} title="Auto Claim">
      <TbGift size={20} />
      <span className={`autoclaim-toolbar-badge${count > 0 ? '' : ' is-hidden'}`} />
    </button>
  );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function findElement(doc: Document, selector: string, timeoutMs = 25000): Promise<Element | undefined> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const el = doc.querySelector(selector);
      if (el) return el;
    } catch {}
    await sleep(500);
  }
  return undefined;
}

let classesLogged = false;

async function tryPatch(doc: Document): Promise<boolean> {
  const steamDesktop = findModule((e: any) => e.FocusBar) as Record<string, string> | undefined;
  const steamPopupTab = findModule((e: any) => e.BrowserTabIcon) as Record<string, string> | undefined;
  if (!steamDesktop?.URLBar && !steamPopupTab?.URLBar) {
    if (!classesLogged) {
      classesLogged = true;
      log('toolbar: URLBar classes not found in webpack modules');
    }
    return false;
  }

  const urlBar = await findElement(
    doc,
    `.${steamDesktop?.URLBar ?? steamPopupTab?.URLBar}, .${steamPopupTab?.URLBar ?? steamDesktop?.URLBar}`,
  );
  if (!urlBar) return false;
  if (doc.querySelector(`.${CONTAINER_CLASS}`) !== null) return true;

  const reactRootOwner = (window as any).SP_REACTDOM;
  if (!reactRootOwner?.createRoot) {
    log('toolbar: SP_REACTDOM not available');
    return true;
  }

  const container = doc.createElement('div');
  container.className = CONTAINER_CLASS;
  urlBar.appendChild(container);

  reactRootOwner.createRoot(container).render(<ToolbarButton />);
  log('toolbar: gift button injected');

  const observer = new MutationObserver(() => {
    void patchUrlBar(doc);
  });
  observer.observe(urlBar, { childList: true, subtree: true });

  return true;
}

export async function patchUrlBar(doc: Document): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      if (await tryPatch(doc)) return;
    } catch (e) {
      log(`toolbar: patch attempt ${attempt} failed: ${String(e)}`);
    }
    await sleep(1000);
  }
  log('toolbar: failed to patch url bar after 30 attempts');
}

function injectStyles(doc: Document): void {
  if (doc.querySelector('#autoclaim-toolbar-styles')) return;
  const style = doc.createElement('style');
  style.id = 'autoclaim-toolbar-styles';
  style.textContent = TOOLBAR_STYLES;
  doc.head.appendChild(style);
}

async function onPopupCreated(popup: any): Promise<void> {
  if (!popup?.m_popup?.document) return;

  const isMainWindow = popup.m_strName === MAIN_WINDOW_NAME;
  const isBrowserPopup =
    popup.m_strName.includes('TabbedPopupBrowser') || popup.m_strName.includes('OverlayBrowser');
  if (!isMainWindow && !isBrowserPopup) return;

  injectStyles(popup.m_popup.document);
  void patchUrlBar(popup.m_popup.document);
}

let callbackRegistered = false;

export function setupToolbar(): void {
  const trySetup = (attempt: number): void => {
    const popupManager = (window as any).g_PopupManager;
    if (!popupManager) {
      if (attempt < 120) setTimeout(() => trySetup(attempt + 1), 1000);
      else log('toolbar: g_PopupManager never became available');
      return;
    }

    if (!callbackRegistered) {
      popupManager.AddPopupCreatedCallback?.(onPopupCreated);
      callbackRegistered = true;
      log('toolbar: popup hooks registered');
    }

    const main = popupManager.GetExistingPopup?.(MAIN_WINDOW_NAME);
    if (main) void onPopupCreated(main);
    else if (attempt < 120) setTimeout(() => trySetup(attempt + 1), 1000);
    else log('toolbar: main window popup never appeared');
  };

  trySetup(0);
}
