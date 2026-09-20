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
  width: 26px !important;
  height: 26px !important;
  color: #ffffff;
}
`;

function GiftIcon(): React.JSX.Element {
  return (
    <svg width="26" height="26" viewBox="0 0 56 56">
      <path d="M0 0h56v56H0z" fill="none" />
      <path
        fill="currentColor"
        d="M25.926 28.539V16.117h-3.492c-3.868 0-5.907-2.508-5.907-4.945c0-2.531 1.875-4.031 4.383-4.031c2.883 0 5.133 2.226 5.133 5.953v3.023h3.914v-3.023c0-3.727 2.25-5.953 5.133-5.953c2.508 0 4.406 1.5 4.406 4.03c0 2.438-2.11 4.946-5.93 4.946h-3.492V28.54h16.524c2.554 0 3.937-.984 3.937-3.492V19.61c0-2.484-1.383-3.492-3.937-3.492h-5.461c1.453-1.312 2.32-3.094 2.32-5.11c0-4.523-3.586-7.78-8.133-7.78c-3.375 0-6.117 1.874-7.312 5.203c-1.196-3.328-3.961-5.203-7.336-5.203c-4.524 0-8.133 3.257-8.133 7.78c0 2.016.844 3.798 2.32 5.11h-5.46c-2.415 0-3.938 1.008-3.938 3.492v5.438c0 2.508 1.406 3.492 3.937 3.492Zm0 24.234V31.047H8.816V46.82c0 3.914 2.297 5.953 6.211 5.953Zm4.148-21.726v21.726h10.899c3.914 0 6.21-2.039 6.21-5.953V31.047Z"
      />
    </svg>
  );
}

function ToolbarButton(): React.JSX.Element {
  return (
    <button type="button" className="autoclaim-toolbar-button" onClick={openManager} title="Auto Claim — Free Games">
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
