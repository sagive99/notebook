import { addPerson, deletePerson, selfPersonId, updatePerson, updateSettings } from '@notebook/core';
import type { SpaceColor } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook } from '../../state/hooks';
import { ColorSwatches, SectionLabel, Sheet, SheetHeader, Toggle } from '../components/primitives';

/** Adds a person, or edits their name, colour, whether they are the user, blocked flag, and running 1:1 notes. */
export const PersonSheet = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const { document, run } = useNotebook();
  const person = id ? document.people[id] : undefined;
  const [name, setName] = useState(person?.name ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');
  const [blocked, setBlocked] = useState(person?.blocked ?? false);
  const [color, setColor] = useState<SpaceColor | null>(person?.color ?? null);
  const wasMe = id !== null && selfPersonId(document) === id;
  const [isMe, setIsMe] = useState(wasMe);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (id && (!person || person.deleted)) {
    return null;
  }

  const save = () => {
    const trimmed = name.trim();

    if (trimmed === '') {
      return;
    }

    run((current, context) => {
      const added = id ? null : addPerson(current, trimmed, context);
      const personId = id ?? added?.person.id ?? '';
      const saved = updatePerson(added?.document ?? current, personId, { name: trimmed, notes, blocked, color }, context);

      return isMe === wasMe ? saved : updateSettings(saved, { selfPersonId: isMe ? personId : null }, context);
    });

    onClose();
  };

  return (
    <Sheet label={id ? 'Edit person' : 'Add person'} onClose={onClose}>
      <SheetHeader title={id ? 'Person' : 'Add person'} onCancel={onClose} action={{ label: 'Save', onClick: save, disabled: name.trim() === '' }} />
      <form class="form" onSubmit={(event) => {
        event.preventDefault();
        save();
      }}>
        <label class="field"><SectionLabel>Name</SectionLabel><input class="text-input text-input--large" dir="auto" maxLength={120} value={name} onInput={(event) => setName(event.currentTarget.value)} /></label>
        <div class="field"><SectionLabel>Colour</SectionLabel><ColorSwatches label="Colour" value={color} onChange={setColor} onAuto={() => setColor(null)} /></div>
        <div class="settings-list">
          <div class="settings-row"><span class="settings-row__label">This is me<span class="settings-row__sub">Their tasks show under Mine on Today, not under Team</span></span><Toggle label="This is me" checked={isMe} onChange={setIsMe} /></div>
          <div class="settings-row"><span class="settings-row__label">Blocked<span class="settings-row__sub">Waiting on something outside their control</span></span><Toggle label="Blocked" checked={blocked} onChange={setBlocked} /></div>
        </div>
        <label class="field"><SectionLabel>1:1 notes</SectionLabel><textarea class="capture-input" dir="auto" rows={7} placeholder="Running notes for check-ins and 1:1s" value={notes} onInput={(event) => setNotes(event.currentTarget.value)} /></label>
        {id ? (
          <div class="danger-zone">
            {confirmDelete ? (
              <>
                <span>Remove {person?.name}? Their tasks stay in the notebook.</span>
                <button type="button" class="danger-button" onClick={() => {
                  run((current, context) => deletePerson(current, id, context));
                  onClose();
                }}>Remove</button>
                <button type="button" class="link-button" onClick={() => setConfirmDelete(false)}>Keep</button>
              </>
            ) : <button type="button" class="link-button link-button--danger" onClick={() => setConfirmDelete(true)}>Remove person</button>}
          </div>
        ) : null}
      </form>
    </Sheet>
  );
};
