import type { IsoDate, ItemKind } from '@notebook/core';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { CalendarEvent } from '../../ports';

export type CapturePreset = {
  kind?: ItemKind;
  day?: IsoDate | null;
  spaceId?: string | null;
  columnId?: string | null;
  personId?: string | null;
  text?: string;
  sourceEmailId?: string | null;
};

export type SheetRequest =
  | { kind: 'capture'; preset?: CapturePreset }
  | { kind: 'item'; id: string }
  | { kind: 'event'; day: IsoDate; event?: CalendarEvent; onSaved?: () => void }
  | { kind: 'person'; id: string | null };

export type SheetControls = {
  open: (request: SheetRequest) => void;
  close: () => void;
};

export const SheetContext = createContext<SheetControls | null>(null);

export const useSheets = (): SheetControls => {
  const controls = useContext(SheetContext);

  if (!controls) {
    throw new Error('useSheets must be used inside SheetContext.');
  }

  return controls;
};
