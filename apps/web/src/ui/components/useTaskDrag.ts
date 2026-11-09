import type { Item } from '@notebook/core';
import { useRef, useState } from 'preact/hooks';

export type DropZone = 'ongoing' | 'next';

export type DropTarget = { zone: DropZone; beforeId: string | null };

type DragState = {
  item: Item;
  personId: string;
  pointerId: number;
  startY: number;
  dy: number;
  target: DropTarget | null;
};

/** Finds the drop zone and insertion point under the pointer, within one person's card. */
const targetAt = (x: number, y: number, personId: string, draggedId: string): DropTarget | null => {
  const elements = document.elementsFromPoint(x, y);
  const zone = elements.find((element): element is HTMLElement => element instanceof HTMLElement && element.dataset.dropZone !== undefined && element.dataset.personId === personId);

  if (!zone || (zone.dataset.dropZone !== 'ongoing' && zone.dataset.dropZone !== 'next')) {
    return null;
  }

  const rows = [...zone.querySelectorAll<HTMLElement>('[data-task-id]')].filter((row) => row.dataset.taskId !== draggedId);
  const before = rows.find((row) => {
    const box = row.getBoundingClientRect();

    return y < box.top + box.height / 2;
  });

  return { zone: zone.dataset.dropZone, beforeId: before?.dataset.taskId ?? null };
};

/**
 * Pointer-based drag for task rows (works with touch, mouse, and pen). Start it from a handle with
 * `touch-action: none`; `onDrop` receives where the task was released inside the same person's card.
 */
export const useTaskDrag = (onDrop: (item: Item, target: DropTarget) => void) => {
  const [drag, setDrag] = useState<DragState | null>(null);
  const latest = useRef<DragState | null>(null);

  const update = (next: DragState | null) => {
    latest.current = next;
    setDrag(next);
  };

  const handleProps = (item: Item, personId: string) => ({
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      update({ item, personId, pointerId: event.pointerId, startY: event.clientY, dy: 0, target: null });
    },
    onPointerMove: (event: PointerEvent) => {
      const current = latest.current;

      if (!current || current.pointerId !== event.pointerId) {
        return;
      }

      update({ ...current, dy: event.clientY - current.startY, target: targetAt(event.clientX, event.clientY, current.personId, current.item.id) });
    },
    onPointerUp: (event: PointerEvent) => {
      const current = latest.current;

      if (!current || current.pointerId !== event.pointerId) {
        return;
      }

      update(null);

      if (current.target && Math.abs(current.dy) > 4) {
        onDrop(current.item, current.target);
      }
    },
    onPointerCancel: () => update(null),
  });

  return { drag, handleProps };
};
