import { addDays, deleteItem, liveSpaces, livePeople, remindersUseCalendar, scheduleItem, toIsoDate, updateItem } from '@notebook/core';
import type { ItemKind, ItemPatch, Priority } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook } from '../../state/hooks';
import type { Command } from '../../state/notebook-store';
import { openShortcut, reminderHandoff } from '../../state/reminders-handoff';
import { Chip, SectionLabel, Sheet, SheetHeader, Toggle } from '../components/primitives';

const KINDS: Array<{ kind: ItemKind; label: string }> = [{ kind: 'task', label: 'Task' }, { kind: 'note', label: 'Note' }, { kind: 'idea', label: 'Idea' }];
const PRIORITIES: Array<{ value: Priority | null; label: string }> = [{ value: null, label: 'None' }, { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }];

const safeLink = (value: string): string | null => {
  try {
    const url = new URL(value);

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Edits one item. Changes apply on Save so a stray tap never edits the notebook. */
export const ItemSheet = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { document, run } = useNotebook();
  const item = document.items[id];
  const [draft, setDraft] = useState<ItemPatch>(() => (item ? { text: item.text, kind: item.kind, day: item.day, time: item.time, remind: item.remind, spaceId: item.spaceId, columnId: item.columnId, personId: item.personId, priority: item.priority, link: item.link, tags: item.tags } : {}));
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!item || item.deleted) {
    return null;
  }

  const today = toIsoDate(new Date());
  const space = draft.spaceId ? document.spaces[draft.spaceId] : undefined;
  const fields = space?.fields ?? { dueDate: true, person: true, priority: true, link: true, tags: true };
  /** Runs a change to this item, then hands its reminder to the iPhone Shortcut if that changed. Call only from a tap. */
  const apply = (change: Command) => {
    let handoff: string | null = null;
    run((current, context) => {
      const next = change(current, context);
      handoff = reminderHandoff(id, next.items[id]);

      return next;
    });
    onClose();
    openShortcut(handoff);
  };
  const set = (patch: ItemPatch) => setDraft((current) => ({ ...current, ...patch }));
  const linkValue = draft.link ?? '';
  const linkInvalid = linkValue.trim() !== '' && safeLink(linkValue.trim()) === null;

  const save = () => {
    if (linkInvalid) {
      return;
    }

    const patch: ItemPatch = {
      ...draft,
      text: (draft.text ?? '').trim(),
      link: linkValue.trim() === '' ? null : safeLink(linkValue.trim()),
      remind: Boolean(draft.remind) && Boolean(draft.day),
      columnId: space?.layout === 'board' ? draft.columnId ?? space.columns[0]?.id ?? null : null,
    };
    apply((current, context) => updateItem(current, id, patch, context));
  };

  const moveTo = (patch: ItemPatch) => {
    apply((current, context) => updateItem(current, id, { ...patch, text: (draft.text ?? item.text).trim() }, context));
  };

  const scheduleFor = (day: string) => {
    apply((current, context) => scheduleItem(updateItem(current, id, { text: (draft.text ?? item.text).trim() }, context), id, day, context));
  };

  return (
    <Sheet label="Edit item" onClose={onClose}>
      <SheetHeader title="Edit" onCancel={onClose} action={{ label: 'Save', onClick: save, disabled: (draft.text ?? '').trim() === '' || linkInvalid }} />
      <form class="form" onSubmit={(event) => {
        event.preventDefault();
        save();
      }}>
        <label class="field">
          <SectionLabel>Text</SectionLabel>
          <textarea class="capture-input" dir="auto" rows={item.kind === 'note' ? 8 : 3} value={draft.text ?? ''} onInput={(event) => set({ text: event.currentTarget.value })} />
        </label>

        <div class="field">
          <SectionLabel>Type</SectionLabel>
          <div class="chip-row">{KINDS.map((option) => <Chip key={option.kind} selected={draft.kind === option.kind} onClick={() => set({ kind: option.kind })}>{option.label}</Chip>)}</div>
        </div>

        <div class="field">
          <SectionLabel>Quick move</SectionLabel>
          <div class="chip-row chip-row--wrap">
            <Chip onClick={() => scheduleFor(today)}>Today</Chip>
            <Chip onClick={() => scheduleFor(addDays(today, 1))}>Tomorrow</Chip>
            {document.settings.backlogSpaceId && document.spaces[document.settings.backlogSpaceId] && !document.spaces[document.settings.backlogSpaceId]?.deleted ? <Chip onClick={() => moveTo({ day: null, time: null, remind: false, spaceId: document.settings.backlogSpaceId, columnId: null })}>Backlog</Chip> : null}
          </div>
        </div>

        <div class="settings-list">
          <label class="settings-row">
            <span class="settings-row__label">Space</span>
            <select class="select" value={draft.spaceId ?? ''} onChange={(event) => set({ spaceId: event.currentTarget.value || null, columnId: null })}>
              <option value="">Notebook (no space)</option>
              {liveSpaces(document).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          {space?.layout === 'board' ? (
            <label class="settings-row">
              <span class="settings-row__label">Column</span>
              <select class="select" value={draft.columnId ?? space.columns[0]?.id ?? ''} onChange={(event) => set({ columnId: event.currentTarget.value })}>
                {space.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
              </select>
            </label>
          ) : null}
          {fields.dueDate || draft.day ? (
            <label class="settings-row">
              <span class="settings-row__label">Day</span>
              <input class="date-input" type="date" value={draft.day ?? ''} onInput={(event) => set({ day: event.currentTarget.value || null })} />
              {draft.day ? <button type="button" class="link-button" onClick={() => set({ day: null, remind: false })}>Clear</button> : null}
            </label>
          ) : null}
          {draft.day ? (
            <label class="settings-row">
              <span class="settings-row__label">Time</span>
              <input class="time-input" type="time" value={draft.time ?? ''} onInput={(event) => set({ time: event.currentTarget.value || null })} />
            </label>
          ) : null}
          {draft.day ? (
            <div class="settings-row">
              <span class="settings-row__label">{remindersUseCalendar(document.settings) ? 'Calendar + reminder' : 'Reminder'}</span>
              <Toggle label={remindersUseCalendar(document.settings) ? 'Calendar + reminder' : 'Reminder'} checked={Boolean(draft.remind)} onChange={(value) => set({ remind: value })} />
            </div>
          ) : null}
          {fields.person || draft.personId ? (
            <label class="settings-row">
              <span class="settings-row__label">Person</span>
              <select class="select" value={draft.personId ?? ''} onChange={(event) => set({ personId: event.currentTarget.value || null })}>
                <option value="">Nobody</option>
                {livePeople(document).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
          ) : null}
          {fields.priority || draft.priority ? (
            <label class="settings-row">
              <span class="settings-row__label">Priority</span>
              <select class="select" value={draft.priority ?? ''} onChange={(event) => set({ priority: (PRIORITIES.find((option) => option.value === event.currentTarget.value)?.value) ?? null })}>
                {PRIORITIES.map((option) => <option key={option.label} value={option.value ?? ''}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          {fields.link || draft.link ? (
            <label class="settings-row">
              <span class="settings-row__label">Link</span>
              <input class="text-input" type="url" inputMode="url" placeholder="https://" value={linkValue} onInput={(event) => set({ link: event.currentTarget.value })} />
            </label>
          ) : null}
          {fields.tags || (draft.tags?.length ?? 0) > 0 ? (
            <label class="settings-row">
              <span class="settings-row__label">Tags</span>
              <input class="text-input" dir="auto" placeholder="work, team" value={(draft.tags ?? []).join(', ')} onInput={(event) => set({ tags: event.currentTarget.value.split(',').map((tag) => tag.trim().replace(/^#/u, '').toLowerCase()).filter(Boolean).slice(0, 32) })} />
            </label>
          ) : null}
        </div>
        {linkInvalid ? <p class="inline-error" role="alert">Links must start with https:// or http://</p> : null}
        {item.link && safeLink(item.link) ? <a class="link-button" href={safeLink(item.link) ?? undefined} target="_blank" rel="noopener noreferrer">Open link</a> : null}

        <div class="danger-zone">
          {confirmDelete ? (
            <>
              <span>Delete this {item.kind}{item.calendarEventId ? ' and its calendar event' : ''}?</span>
              <button type="button" class="danger-button" onClick={() => {
                apply((current, context) => deleteItem(current, id, context));
              }}>Delete</button>
              <button type="button" class="link-button" onClick={() => setConfirmDelete(false)}>Keep</button>
            </>
          ) : <button type="button" class="link-button link-button--danger" onClick={() => setConfirmDelete(true)}>Delete</button>}
        </div>
      </form>
    </Sheet>
  );
};
