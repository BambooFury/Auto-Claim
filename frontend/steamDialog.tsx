import { findModuleExport, ModalRoot } from 'millennium';
import React from 'react';

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

const GenericDialog = findModuleExport((e: any) =>
  e?.toString?.()?.includes('.popupHeight') === true
  && e?.toString?.()?.includes('.popupWidth') === true
  && e?.toString?.()?.includes('.onlyPopoutIfNeeded') === true) as React.FC<SteamDialogProps> | undefined;

export function SteamDialog({
  children,
  ...props
}: SteamDialogProps & { readonly children?: React.ReactNode }): React.JSX.Element | null {
  if (!GenericDialog) return null;

  return (
    <GenericDialog {...props} modal={false}>
      <ModalRoot onCancel={props.onDismiss}>
        {children}
      </ModalRoot>
    </GenericDialog>
  );
}
