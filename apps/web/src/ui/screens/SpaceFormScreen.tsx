import { addSpace, deleteSpace, isWorkSpace, updateSpace } from '@notebook/core';
import type { BoardColumn, SpaceColor, SpaceFields, SpaceLayout } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook } from '../../state/hooks';
import { ScreenHeader } from '../components/chrome';
import { SectionLabel, Toggle } from '../components/primitives';
import { SPACE_COLORS, initials } from '../format';
import { href, navigate } from '../router';

const LAYOUTS: Array<{ layout: SpaceLayout; name: string; sub: string }> = [
  { layout: 'list', name: 'List', sub: 'A simple checklist, like a page' },
  { layout: 'board', name: 'Board', sub: 'Columns, e.g. To do / Doing / Done' },
  { layout: 'people', name: 'People', sub: 'A card per person with their items' },
  { layout: 'notes', name: 'Notes', sub: 'Free text pages, no checkboxes' },
];

const FIELD_LABELS: Array<{ key: keyof SpaceFields; label: string }> = [
  { key: 'dueDate', label: 'Due date' },
  { key: 'person', label: 'Person' },
  { key: 'priority', label: 'Priority' },
  { key: 'link', label: 'Link' },
  { key: 'tags', label: 'Tags' },
];

const COLORS = Object.keys(SPACE_COLORS) as SpaceColor[];

/** Creates a space, or edits one when an id is given. Layout is fixed after creation; everything else can change. */
export const SpaceFormScreen = ({ id }: { id?: string }) => {
  const { document, run } = useNotebook();
  const existing = id ? document.spaces[id] : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState<SpaceColor>(existing?.color ?? 'teal');
  const [layout, setLayout] = useState<SpaceLayout>(existing?.layout ?? 'list');
  const [fields, setFields] = useState<SpaceFields>(existing?.fields ?? { dueDate: true, person: false, priority: false, link: false, tags: false });
  const [columns, setColumns] = useState<BoardColumn[]>(existing?.columns ?? []);
  const [showOnToday, setShowOnToday] = useState(existing?.showOnToday ?? false);
  // Null keeps the default rule (People-layout spaces are work) until the user chooses.
  const [workChoice, setWorkChoice] = useState<boolean | null>(existing?.work ?? null);
  const work = isWorkSpace({ work: workChoice, layout });
  const [inCapture, setInCapture] = useState(existing?.inCapture ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (id && (!existing || existing.deleted)) {
    return <div class="screen"><ScreenHeader title="Space not found" back={{ label: 'Spaces', href: href({ name: 'spaces' }) }} /></div>;
  }

  const canSave = name.trim() !== '' && (layout !== 'board' || !existing || columns.every((column) => column.name.trim() !== ''));

  const save = () => {
    if (!canSave) {
      return;
    }

    if (existing) {
      run((current, context) => updateSpace(current, existing.id, { name: name.trim(), color, fields, columns: columns.map((column) => ({ ...column, name: column.name.trim() })), showOnToday, work: workChoice, inCapture }, context));
      navigate({ name: 'space', id: existing.id });

      return;
    }

    const newId = crypto.randomUUID();
    run((current, context) => addSpace(current, { id: newId, name, color, layout, fields, showOnToday, work: workChoice, inCapture }, context).document);
    navigate({ name: 'space', id: newId });
  };

  return (
    <div class="screen">
      <ScreenHeader title={existing ? 'Space settings' : 'New space'} back={{ label: existing ? existing.name : 'Spaces', href: existing ? href({ name: 'space', id: existing.id }) : href({ name: 'spaces' }) }} actions={<button type="button" class="pill-button" disabled={!canSave} onClick={save}>{existing ? 'Save' : 'Create'}</button>} />
      <form class="form form--screen" onSubmit={(event) => {
        event.preventDefault();
        save();
      }}>
        <div class="name-row">
          <span class="space-mark space-mark--large" style={{ background: SPACE_COLORS[color].bg, color: SPACE_COLORS[color].fg }} aria-hidden="true">{initials(name || '?').charAt(0)}</span>
          <label class="field field--grow"><SectionLabel>Name</SectionLabel><input class="text-input text-input--large" dir="auto" maxLength={80} placeholder="e.g. Work projects" value={name} onInput={(event) => setName(event.currentTarget.value)} /></label>
        </div>

        <div class="swatches" role="radiogroup" aria-label="Color">
          {COLORS.map((option) => <button key={option} type="button" role="radio" aria-checked={color === option} aria-label={option} class={`swatch ${color === option ? 'swatch--selected' : ''}`} style={{ background: SPACE_COLORS[option].swatch }} onClick={() => setColor(option)} />)}
        </div>

        <div class="field">
          <SectionLabel>Layout{existing ? ' (fixed after creation)' : ''}</SectionLabel>
          <div class="layout-grid">
            {LAYOUTS.map((option) => (
              <button key={option.layout} type="button" class={`layout-option ${layout === option.layout ? 'layout-option--selected' : ''}`} aria-pressed={layout === option.layout} disabled={Boolean(existing) && existing?.layout !== option.layout} onClick={() => setLayout(option.layout)}>
                <span class="layout-option__name">{option.name}</span>
                <span class="layout-option__sub">{option.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {existing?.layout === 'board' ? (
          <div class="field">
            <SectionLabel>Columns</SectionLabel>
            {columns.map((column, index) => (
              <div key={column.id} class="column-row">
                <input class="text-input" dir="auto" aria-label={`Column ${index + 1} name`} maxLength={60} value={column.name} onInput={(event) => {
                  const value = event.currentTarget.value;
                  setColumns(columns.map((entry) => (entry.id === column.id ? { ...entry, name: value } : entry)));
                }} />
                <button type="button" class="link-button link-button--danger" disabled={columns.length <= 1 || Object.values(document.items).some((item) => !item.deleted && item.columnId === column.id)} onClick={() => setColumns(columns.filter((entry) => entry.id !== column.id))}>Remove</button>
              </div>
            ))}
            {columns.length < 12 ? <button type="button" class="soft-button" onClick={() => setColumns([...columns, { id: crypto.randomUUID(), name: 'New column' }])}>+ Column</button> : null}
            <span class="hint">A column can be removed once it is empty. The last column counts as “done”.</span>
          </div>
        ) : null}

        {layout !== 'people' && layout !== 'notes' ? (
          <div class="field">
            <SectionLabel>Fields on each item</SectionLabel>
            <div class="chip-row chip-row--wrap">
              {FIELD_LABELS.map((field) => <button key={field.key} type="button" class={`chip ${fields[field.key] ? 'chip--selected' : ''}`} aria-pressed={fields[field.key]} onClick={() => setFields({ ...fields, [field.key]: !fields[field.key] })}>{fields[field.key] ? '✓ ' : '+ '}{field.label}</button>)}
            </div>
          </div>
        ) : null}

        <div class="settings-list">
          <div class="settings-row"><span class="settings-row__label">Show on Today<span class="settings-row__sub">Items with a day appear in your notebook</span></span><Toggle label="Show on Today" checked={showOnToday} onChange={setShowOnToday} /></div>
          <div class="settings-row"><span class="settings-row__label">Work space<span class="settings-row__sub">Hidden on Today while Work is switched off</span></span><Toggle label="Work space" checked={work} onChange={setWorkChoice} /></div>
          <div class="settings-row"><span class="settings-row__label">Show in quick capture</span><Toggle label="Show in quick capture" checked={inCapture} onChange={setInCapture} /></div>
        </div>

        {existing ? (
          <div class="danger-zone">
            {confirmDelete ? (
              <>
                <span>Delete “{existing.name}” and everything in it?</span>
                <button type="button" class="danger-button" onClick={() => {
                  run((current, context) => deleteSpace(current, existing.id, context));
                  navigate({ name: 'spaces' });
                }}>Delete</button>
                <button type="button" class="link-button" onClick={() => setConfirmDelete(false)}>Keep</button>
              </>
            ) : <button type="button" class="link-button link-button--danger" onClick={() => setConfirmDelete(true)}>Delete space</button>}
          </div>
        ) : null}
      </form>
    </div>
  );
};
