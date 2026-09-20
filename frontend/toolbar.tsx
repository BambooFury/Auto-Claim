import { findModule, Millennium } from 'millennium';
import React from 'react';
import { openManager } from './manager';
import { logIPC } from './ipc';

const log = (msg: string) => { logIPC({ payload: msg }).catch(() => {}); };

const MAIN_WINDOW_NAME = 'SP Desktop_uid0';
const CONTAINER_CLASS = 'autoclaim-toolbar-container';

const TOOLBAR_STYLES = `
.${CONTAINER_CLASS} {
  margin-left: auto;
  margin-right: 0.5rem;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
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
  width: 20px !important;
  height: 20px !important;
  color: #ffffff;
}
`;

function GiftIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 7v14" />
      <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
      <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" />
      <rect width="18" height="4" x="3" y="7" rx="1" />
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

function findElement(doc: Document, selector: string): Promise<Element | undefined> {
  return Millennium.findElement(doc, selector).then((nodes) => [...nodes][0]);
}

export async function patchUrlBar(doc: Document): Promise<void> {
  try {
    const steamDesktop = findModule((e: any) => e.FocusBar) as Record<string, string> | undefined;
    const steamPopupTab = findModule((e: any) => e.BrowserTabIcon) as Record<string, string> | undefined;
    if (!steamDesktop?.URLBar && !steamPopupTab?.URLBar) return;

    const urlBar = await findElement(
      doc,
      `.${steamDesktop?.URLBar ?? steamPopupTab?.URLBar}, .${steamPopupTab?.URLBar ?? steamDesktop?.URLBar}`,
    );
    if (!urlBar) {
      log('toolbar: url bar element not found');
      return;
    }
    if (doc.querySelector(`.${CONTAINER_CLASS}`) !== null) return;

    const container = doc.createElement('div');
    container.className = CONTAINER_CLASS;
    urlBar.appendChild(container);
    log('toolbar: gift button injected');

    const reactRoot = (window as any).SP_REACTDOM.createRoot(container);
    reactRoot.render(<ToolbarButton />);

    const observer = new MutationObserver(() => {
      patchUrlBar(doc);
    });
    observer.observe(urlBar, { childList: true, subtree: true });
  } catch (e) {
    console.error('[AutoClaim] url bar patch failed:', e);
  }
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
  await patchUrlBar(popup.m_popup.document);
}

export function setupToolbar(): void {
  const popupManager = (window as any).g_PopupManager;
  if (!popupManager) return;

  const main = popupManager.GetExistingPopup?.(MAIN_WINDOW_NAME);
  if (main) void onPopupCreated(main);

  popupManager.AddPopupCreatedCallback?.(onPopupCreated);
}
