import { addPerson, deletePerson, updatePerson } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook } from '../../state/hooks';
import { SectionLabel, Sheet, SheetHeader, Toggle } from '../components/primitives';

/** Adds a person, or edits their name, current focus, and running 1:1 notes. */
export const PersonSheet = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const { document, run } = useNotebook();
  const person = id ? document.people[id] : undefined;
  const [name, setName] = useState(person?.name ?? '');
  const [now, setNow] = useState(person?.now ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');
  const [blocked, setBlocked] = useState(person?.blocked ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (id && (!person || person.deleted)) {
    return null;
  }

  const save = () => {
    const trimmed = name.trim();

    if (trimmed === '') {
      return;
    }

    if (id) {
      run((current, context) => updatePerson(current, id, { name: trimmed, now: now.trim(), notes, blocked }, context));
    } else {
      run((current, context) => {
        const added = addPerson(current, trimmed, context);

        return now.trim() === '' && notes === '' && !blocked ? added.document : updatePerson(added.document, added.person.id, { now: now.trim(), notes, blocked }, context);
      });
    }

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
        <label class="field"><SectionLabel>Working on now</SectionLabel><input class="text-input" dir="auto" maxLength={500} placeholder="What are they on right now?" value={now} onInput={(event) => setNow(event.currentTarget.value)} /></label>
        <div class="settings-list"><div class="settings-row"><span class="settings-row__label">Blocked<span class="settings-row__sub">Waiting on something outside their control</span></span><Toggle label="Blocked" checked={blocked} onChange={setBlocked} /></div></div>
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
