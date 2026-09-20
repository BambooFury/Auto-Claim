import { findModuleExport, ModalRoot } from 'millennium';
import React from 'react';
import { logIPC } from './ipc';

const log = (msg: string) => { logIPC({ payload: msg }).catch(() => {}); };

export interface SteamDialogProps {
  readonly strTitle: string;
  readonly strName?: string;
  readonly children?: React.ReactNode;
  onDismiss(): void;
  readonly popupWidth?: number;
  readonly popupHeight?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly resizable?: boolean;
  readonly fullscreen?: boolean;
  readonly modal?: boolean;
  readonly onlyPopoutIfNeeded?: boolean;
  readonly titleBarClassName?: string;
  readonly saveDimensionsKey?: string;
}

let cachedDialog: React.FC<any> | undefined | null = null;

function resolveGenericDialog(): React.FC<any> | undefined {
  if (cachedDialog !== null) return cachedDialog;
  try {
    cachedDialog = findModuleExport((e: any) =>
      e?.toString?.()?.includes('.popupHeight') === true
      && e?.toString?.()?.includes('.popupWidth') === true
      && e?.toString?.()?.includes('.onlyPopoutIfNeeded') === true) as React.FC<any> | undefined;
  } catch (e) {
    log(`steamDialog: GenericDialog resolve failed: ${String(e)}`);
    cachedDialog = undefined;
  }
  return cachedDialog;
}

export function SteamDialog({
  children,
  ...props
}: SteamDialogProps & { readonly children?: React.ReactNode }): React.JSX.Element | null {
  const GenericDialog = resolveGenericDialog();
  if (!GenericDialog) {
    log('steamDialog: GenericDialog not found in steam runtime');
    return null;
  }

  return (
    <GenericDialog {...props} modal={false}>
      <ModalRoot onCancel={props.onDismiss}>
        {children}
      </ModalRoot>
    </GenericDialog>
  );
}
