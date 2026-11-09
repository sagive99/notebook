import { liveSpaces, todayBlocks, updateSettings } from '@notebook/core';
import type { NotebookDocument, TodayBlock, TodayBlockId } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useAuthState, useCalendarList, useNotebook, useServices } from '../../state/hooks';
import { ScreenHeader, SyncDot } from '../components/chrome';
import { SectionLabel, Toggle } from '../components/primitives';
import { ArrowDownIcon, ArrowUpIcon } from '../icons';
import { href } from '../router';

const BLOCK_TEXT: Record<string, { name: string; sub: string }> = {
  schedule: { name: 'Schedule', sub: 'Google Calendar events for the day' },
  notebook: { name: 'Notebook', sub: 'The day’s tasks and notes' },
  'team-waiting': { name: 'Team · waiting on', sub: 'Open tasks linked to people' },
  'gmail-starred': { name: 'Starred in Gmail', sub: 'Turn starred emails into tasks' },
  'backlog-pick': { name: 'One idea from the backlog', sub: 'A gentle nudge from your ideas' },
};

const describe = (document: NotebookDocument, id: TodayBlockId): { name: string; sub: string } => {
  if (id.startsWith('space:')) {
    const space = document.spaces[id.slice('space:'.length)];

    return { name: space?.name ?? 'Space', sub: 'Open items from this space' };
  }

  return BLOCK_TEXT[id] ?? { name: id, sub: '' };
};

const AccountSection = () => {
  const services = useServices();
  const auth = useAuthState();
  const { status } = useNotebook();
  const [error, setError] = useState<string | null>(null);

  if (!services.auth) {
    return (
      <div class="field">
        <SectionLabel>Account & sync</SectionLabel>
        <div class="settings-list"><p class="settings-row settings-row--text">This copy runs in local mode: everything is saved on this device only. Add a Google client ID to the deployment to sync with Calendar and Drive (docs/setup/google-cloud.md).</p></div>
      </div>
    );
  }

  const run = async (action: () => Promise<void>) => {
    setError(null);

    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong.');
    }
  };

  const syncLabel = status.kind === 'synced' ? `Synced at ${new Date(status.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : status.kind === 'syncing' || status.kind === 'pending' ? 'Syncing…' : status.kind === 'offline' ? 'Offline' : status.kind === 'error' ? status.message : status.kind === 'needs-auth' ? 'Needs reconnect' : 'Not connected';

  return (
    <div class="field">
      <SectionLabel>Account & sync</SectionLabel>
      <div class="settings-list">
        <div class="settings-row"><span class="settings-row__label">Google<span class="settings-row__sub">Calendar, Drive backup{services.gmailGranted() ? ', Gmail' : ''}</span></span>
          {auth.status === 'signed-in' ? <button type="button" class="link-button link-button--danger" onClick={() => void run(services.disconnect)}>Disconnect</button> : <button type="button" class="pill-button pill-button--small" onClick={() => void run(() => services.connect())}>{auth.status === 'expired' ? 'Reconnect' : 'Connect'}</button>}
        </div>
        <div class="settings-row"><span class="settings-row__label">Sync <SyncDot /><span class="settings-row__sub">{syncLabel}</span></span><button type="button" class="soft-button" disabled={auth.status !== 'signed-in'} onClick={() => {
          void services.store.sync();
          void services.calendarSync.flush();
        }}>Sync now</button></div>
      </div>
      {error ? <p class="inline-error" role="alert">{error}</p> : null}
      <p class="hint">Your notebook is stored in a private app folder in your Google Drive and on this phone. To see app events on the iPhone Calendar, add the same Google account in iPhone Settings → Calendar → Accounts.</p>
    </div>
  );
};

const CalendarsSection = () => {
  const services = useServices();
  const auth = useAuthState();
  const granted = auth.status === 'signed-in' && services.calendarsGranted();
  const { state } = useCalendarList(granted);
  const [shown, setShown] = useState(services.shownCalendars);
  const [work, setWork] = useState(services.workCalendars);
  const [error, setError] = useState<string | null>(null);

  if (!services.calendar || auth.status !== 'signed-in') {
    return null;
  }

  const toggle = (calendarId: string, on: boolean) => {
    const next = on ? [...shown, calendarId] : shown.filter((id) => id !== calendarId);
    services.setShownCalendars(next);
    setShown(next);
  };

  const toggleWork = (calendarId: string) => {
    const next = work.includes(calendarId) ? work.filter((id) => id !== calendarId) : [...work, calendarId];
    services.setWorkCalendars(next);
    setWork(next);
  };
  const workChip = (calendarId: string, name: string) => <button type="button" class={`chip chip--small ${work.includes(calendarId) ? 'chip--selected' : ''}`} aria-pressed={work.includes(calendarId)} aria-label={`${name} is a work calendar`} onClick={() => toggleWork(calendarId)}>Work</button>;

  return (
    <div class="field">
      <SectionLabel>Calendars on Schedule</SectionLabel>
      <div class="settings-list">
        {!granted ? <div class="settings-row"><span class="settings-row__label">Main calendar</span>{workChip('primary', 'Main calendar')}</div> : null}
        {!granted ? (
          <div class="settings-row"><span class="settings-row__label">Other calendars<span class="settings-row__sub">Show shared and subscribed calendars too</span></span>
            <button type="button" class="pill-button pill-button--small" onClick={() => {
              setError(null);
              services.connectCalendars().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Something went wrong.'));
            }}>Choose</button>
          </div>
        ) : null}
        {state.kind === 'loading' ? <p class="settings-row settings-row--text">Loading…</p> : null}
        {state.kind === 'error' ? <p class="settings-row settings-row--text">{state.message}</p> : null}
        {state.kind === 'ready' ? state.data.map((calendar) => (
          <div key={calendar.id} class="settings-row">
            <span class="settings-row__label" dir="auto">{calendar.name}</span>
            {workChip(calendar.id, calendar.name)}
            <Toggle label={`Show ${calendar.name}`} checked={shown.includes(calendar.id)} onChange={(on) => toggle(calendar.id, on)} />
          </div>
        )) : null}
      </div>
      {error ? <p class="inline-error" role="alert">{error}</p> : null}
      <p class="hint">Calendars marked <b>Work</b> are hidden on Today while Work is switched off. This is remembered on this phone.</p>
    </div>
  );
};

export const CustomizeScreen = () => {
  const { document, run } = useNotebook();
  const blocks = todayBlocks(document);
  const spaces = liveSpaces(document);

  const saveBlocks = (next: TodayBlock[]) => run((current, context) => updateSettings(current, { todayBlocks: next }, context));
  const move = (index: number, offset: number) => {
    const target = index + offset;

    if (target < 0 || target >= blocks.length) {
      return;
    }

    const next = [...blocks];
    const [moved] = next.splice(index, 1);

    if (moved) {
      next.splice(target, 0, moved);
      saveBlocks(next);
    }
  };

  return (
    <div class="screen">
      <ScreenHeader title="Customize Today" back={{ label: 'Today', href: href({ name: 'today' }) }} />
      <div class="form form--screen">
        <div class="field">
          <SectionLabel>Blocks on your Today page</SectionLabel>
          <ul class="settings-list">
            {blocks.map((block, index) => {
              const text = describe(document, block.id);

              return (
                <li key={block.id} class="settings-row">
                  <span class="reorder">
                    <button type="button" class="icon-button" aria-label={`Move ${text.name} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUpIcon size={16} /></button>
                    <button type="button" class="icon-button" aria-label={`Move ${text.name} down`} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDownIcon size={16} /></button>
                  </span>
                  <span class="settings-row__label" dir="auto">{text.name}<span class="settings-row__sub">{text.sub}</span></span>
                  <Toggle label={`Show ${text.name}`} checked={block.enabled} onChange={(enabled) => saveBlocks(blocks.map((entry) => (entry.id === block.id ? { ...entry, enabled } : entry)))} />
                </li>
              );
            })}
          </ul>
        </div>

        <div class="field">
          <SectionLabel>Notebook rules</SectionLabel>
          <div class="settings-list">
            <div class="settings-row"><span class="settings-row__label">Carry unfinished tasks to today</span><Toggle label="Carry unfinished tasks to today" checked={document.settings.carryOver} onChange={(carryOver) => run((current, context) => updateSettings(current, { carryOver }, context))} /></div>
            <label class="settings-row"><span class="settings-row__label">Evening starts at<span class="settings-row__sub">After this, new items default to tomorrow</span></span><input class="time-input" type="time" value={document.settings.eveningCutoff} onChange={(event) => {
              const value = event.currentTarget.value;

              if (/^([01]\d|2[0-3]):[0-5]\d$/u.test(value)) {
                run((current, context) => updateSettings(current, { eveningCutoff: value }, context));
              }
            }} /></label>
            <label class="settings-row"><span class="settings-row__label">Backlog space</span><select class="select" value={document.settings.backlogSpaceId ?? ''} onChange={(event) => {
              const backlogSpaceId = event.currentTarget.value || null;
              run((current, context) => updateSettings(current, { backlogSpaceId }, context));
            }}><option value="">None</option>{spaces.filter((space) => space.layout === 'list').map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
          </div>
        </div>

        <CalendarsSection />

        <AccountSection />
      </div>
    </div>
  );
};
