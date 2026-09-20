import { findModule } from 'millennium';
import React from 'react';
import { openManager } from './manager';
import { logIPC } from './ipc';

const log = (msg: string) => { logIPC({ payload: msg }).catch(() => {}); };

const MAIN_WINDOW_NAME = 'SP Desktop_uid0';
const CONTAINER_CLASS = 'autoclaim-toolbar-container';

const TOOLBAR_STYLES = `
.${CONTAINER_CLASS} {
  flex: 1 1 0;
  min-width: 0;
  margin-left: auto;
  margin-right: 0.5rem;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.${CONTAINER_CLASS} * {
  -webkit-app-region: no-drag;
}
.ModalDialogBody .${CONTAINER_CLASS} {
  margin-right: 1rem;
}
.autoclaim-toolbar-button {
  width: 32px;
  min-width: unset !important;
  height: 32px;
  min-height: unset !important;
  padding: 6px;
  box-sizing: border-box;
  border-radius: 50%;
  position: relative;
  transition: background 0.2s ease;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.autoclaim-toolbar-button:hover {
  background: rgba(255, 255, 255, 0.2);
}
.autoclaim-toolbar-button svg {
  display: block !important;
  width: 20px !important;
  height: 20px !important;
  color: #ffffff;
}
`;

function GiftIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path d="M0 0h20v20H0z" fill="none" />
      <path
        fill="currentColor"
        d="M12 2a2.5 2.5 0 0 1 2 4.001L16 6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1v4.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5V11a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1l2 .001a2.5 2.5 0 1 1 4-3A2.49 2.49 0 0 1 12 2m-2.5 9H5v4.5A1.5 1.5 0 0 0 6.5 17h3zm5.5 0h-4.5v6h3a1.5 1.5 0 0 0 1.5-1.5zM9.5 7H4v3h5.5zM16 7h-5.5v3H16zm-4-4a1.5 1.5 0 0 0-1.5 1.5V6H12a1.5 1.5 0 0 0 0-3M8 3a1.5 1.5 0 0 0-.144 2.993L8 6h1.5V4.5l-.007-.144A1.5 1.5 0 0 0 8 3"
      />
    </svg>
  );
}

function ToolbarButton(): React.JSX.Element {
  return (
    <button type="button" className="autoclaim-toolbar-button" onClick={openManager} title="Auto Claim">
      <GiftIcon />
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
