import type { Item, PeopleBoardTarget } from '@notebook/core';
import { useRef, useState } from 'preact/hooks';

export type DropTarget = PeopleBoardTarget;

type DragSession = {
  item: Item;
  personId: string;
  pointerId: number;
  startY: number;
  dy: number;
  row: HTMLElement | null;
  target: DropTarget | null;
  frame: number | null;
};

/** What the board renders from: which task is lifted and where it would land. Changes only when the target does. */
export type DragView = { itemId: string; personId: string; target: DropTarget | null };

/** Finds the drop zone and insertion point under the pointer, within one person's card. */
const targetAt = (x: number, y: number, personId: string, draggedId: string): DropTarget | null => {
  const zone = document.elementsFromPoint(x, y).find((element): element is HTMLElement => element instanceof HTMLElement && element.dataset.dropZone !== undefined && element.dataset.personId === personId);
  const kind = zone?.dataset.dropZone;

  if (!zone || (kind !== 'ongoing' && kind !== 'next')) {
    return null;
  }

  const rows = [...zone.querySelectorAll<HTMLElement>('[data-task-id]')].filter((row) => row.dataset.taskId !== draggedId);
  const before = rows.find((row) => {
    const box = row.getBoundingClientRect();

    return y < box.top + box.height / 2;
  });

  return { zone: kind, beforeId: before?.dataset.taskId ?? null };
};

const sameTarget = (left: DropTarget | null, right: DropTarget | null): boolean => left?.zone === right?.zone && left?.beforeId === right?.beforeId;

/**
 * Pointer-based drag for task rows (touch, mouse, pen), started from a handle with `touch-action: none`.
 * The lifted row follows the finger by writing its transform directly once per animation frame; React state
 * changes only when the drop target changes, so the board doesn't re-render on every pointer move.
 */
export const useTaskDrag = (onDrop: (item: Item, target: DropTarget) => void) => {
  const [view, setView] = useState<DragView | null>(null);
  const session = useRef<DragSession | null>(null);

  const finish = (drop: boolean) => {
    const current = session.current;
    session.current = null;
    setView(null);

    if (!current) {
      return;
    }

    if (current.frame !== null) {
      cancelAnimationFrame(current.frame);
    }

    if (current.row) {
      current.row.style.transform = '';
    }

    if (drop && current.target && Math.abs(current.dy) > 4) {
      onDrop(current.item, current.target);
    }
  };

  const handleProps = (item: Item, personId: string) => ({
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      session.current = { item, personId, pointerId: event.pointerId, startY: event.clientY, dy: 0, row: event.currentTarget.closest<HTMLElement>('[data-task-id]'), target: null, frame: null };
      setView({ itemId: item.id, personId, target: null });
    },
    onPointerMove: (event: PointerEvent) => {
      const current = session.current;

      if (!current || current.pointerId !== event.pointerId) {
        return;
      }

      current.dy = event.clientY - current.startY;
      const { clientX, clientY } = event;

      if (current.frame !== null) {
        return;
      }

      current.frame = requestAnimationFrame(() => {
        current.frame = null;

        if (current.row) {
          current.row.style.transform = `translateY(${current.dy}px)`;
        }

        const target = targetAt(clientX, clientY, current.personId, current.item.id);

        if (!sameTarget(target, current.target)) {
          current.target = target;
          setView({ itemId: current.item.id, personId: current.personId, target });
        }
      });
    },
    onPointerUp: (event: PointerEvent) => {
      if (session.current?.pointerId === event.pointerId) {
        finish(true);
      }
    },
    onPointerCancel: () => finish(false),
  });

  return { drag: view, handleProps };
};
