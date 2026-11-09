import { useNotebook, useToday } from '../../state/hooks';
import { ScreenHeader } from '../components/chrome';
import { PeopleBoard } from '../components/PeopleBoard';
import { PlusIcon } from '../icons';
import { useSheets } from '../sheets/sheet-context';

export const PeopleScreen = () => {
  const today = useToday();
  const sheets = useSheets();
  const { document } = useNotebook();

  return (
    <div class="screen">
      <ScreenHeader eyebrow="Your team" title="People" actions={<button type="button" class="round-button round-button--dark" aria-label="Add person" onClick={() => sheets.open({ kind: 'person', id: null })}><PlusIcon size={20} /></button>} />
      <PeopleBoard today={today} spaceId={document.settings.teamSpaceId && document.spaces[document.settings.teamSpaceId]?.deleted === false ? document.settings.teamSpaceId : null} />
    </div>
  );
};
