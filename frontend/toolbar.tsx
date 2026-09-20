import { findModule, Millennium } from 'millennium';
import React from 'react';
import { openManager } from './manager';

const MAIN_WINDOW_NAME = 'SP Desktop_uid0';

const TOOLBAR_STYLES = `
.autoclaim-toolbar-container {
  margin-left: auto;
  margin-right: 0.5rem;
  -webkit-app-region: no-drag;
  display: flex;
}
.autoclaim-toolbar-container * {
  -webkit-app-region: no-drag;
}
.ModalDialogBody .autoclaim-toolbar-container {
  margin-right: 1rem;
}
.autoclaim-toolbar-button {
  width: 31px;
  min-width: unset !important;
  height: 31px;
  min-height: unset !important;
  padding: 7px;
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
  background: rgba(255, 255, 255, 0.16);
}
.autoclaim-toolbar-button svg {
  display: block !important;
  color: currentColor;
}
`;

function GiftIcon(): React.JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5" />
      <path d="M21 12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1" />
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

export async function patchUrlBar(doc: Document): Promise<void> {
  const classes = {
    steamdesktop: findModule((e: any) => e.FocusBar) as Record<string, string>,
    steamPopupTab: findModule((e: any) => e.BrowserTabIcon) as Record<string, string>,
  };
  const urlBar = await findElement(doc, `.${classes.steamdesktop?.URLBar}, .${classes.steamPopupTab?.URLBar}`);

  if (!urlBar || doc.querySelector('.autoclaim-toolbar-container') !== null) {
    return;
  }

  const container = doc.createElement('div');
  container.className = 'autoclaim-toolbar-container';
  urlBar.appendChild(container);

  const reactRoot = (window as any).SP_REACTDOM.createRoot(container);
  reactRoot.render(<ToolbarButton />);
}

function findElement(doc: Document, selector: string): Promise<Element | undefined> {
  return Millennium.findElement(doc, selector).then((nodes) => nodes[0]);
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
