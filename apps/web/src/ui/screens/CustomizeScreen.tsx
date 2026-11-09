import { liveSpaces, remindersUseCalendar, todayBlocks, updateSettings } from '@notebook/core';
import type { NotebookDocument, TodayBlock, TodayBlockId } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useAuthState, useCalendarList, useNotebook, useServices } from '../../state/hooks';
import { ScreenHeader, SyncDot } from '../components/chrome';
import { SectionLabel, Toggle } from '../components/primitives';
import { ArrowDownIcon, ArrowUpIcon } from '../icons';
import { href } from '../router';
import { SHORTCUT_NAME, openShortcut, remindersEnabled, setRemindersEnabled, testReminderUrl } from '../../state/reminders-handoff';

const BLOCK_TEXT: Record<string, { name: string; sub: string }> = {
  schedule: { name: 'Schedule', sub: 'Google Calendar events for the day' },
  notebook: { name: 'Notebook', sub: 'The day’s tasks and notes' },
  'team-waiting': { name: 'Team · waiting on', sub: 'Open tasks linked to people' },
  'gmail-starred': { name: 'Important in Gmail', sub: 'New important emails, ready to become tasks' },
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

const RemindersSection = () => {
  const { document, run } = useNotebook();
  const [enabled, setEnabled] = useState(remindersEnabled);
  const useCalendar = remindersUseCalendar(document.settings);

  return (
    <div class="field">
      <SectionLabel>Reminders</SectionLabel>
      <div class="settings-list">
        <div class="settings-row">
          <span class="settings-row__label">Also add to the Reminders app<span class="settings-row__sub">Through the “{SHORTCUT_NAME}” shortcut</span></span>
          <Toggle label="Also add to the Reminders app" checked={enabled} onChange={(on) => {
            setRemindersEnabled(on);
            setEnabled(on);
          }} />
        </div>
        <div class="settings-row">
          <span class="settings-row__label">Also put reminders in Google Calendar<span class="settings-row__sub">On every device. Turning it off removes the events of upcoming reminders</span></span>
          <Toggle label="Also put reminders in Google Calendar" checked={useCalendar} onChange={(on) => run((current, context) => updateSettings(current, { calendarForReminders: on }, context))} />
        </div>
        {enabled ? (
          <div class="settings-row">
            <span class="settings-row__label">Check the shortcut<span class="settings-row__sub">Adds a test reminder for 2 minutes from now</span></span>
            <button type="button" class="pill-button pill-button--small" onClick={() => openShortcut(testReminderUrl(new Date()))}>Test</button>
          </div>
        ) : null}
      </div>
      <p class="hint">Items with <b>{useCalendar ? 'Calendar + reminder' : 'Reminder'}</b> are handed to the shortcut when you save them, so the Shortcuts app opens for a moment; tap “‹ Notebook” at the top left to come back. Checking a reminder off in Reminders doesn’t check it off here. Remembered on this phone.</p>
      {enabled ? (
        <details class="setup-steps">
          <summary>Set up the shortcut (once)</summary>
          <ol>
            <li>Open <b>Shortcuts</b>, tap <b>+</b>, and name the shortcut <b>{SHORTCUT_NAME}</b> exactly.</li>
            <li>Add <b>Get Dictionary from Input</b> (input: Shortcut Input).</li>
            <li>Add <b>Get Dictionary Value</b> for key <b>tag</b>.</li>
            <li>Add <b>Find Reminders</b>: filter <b>Notes contains</b> the Dictionary Value from step 3.</li>
            <li>Add <b>If</b> Reminders <b>has any value</b>, and inside it <b>Remove Reminders</b> with them. This replaces the older copy when you edit an item.</li>
            <li>Add <b>Get Dictionary Value</b> for key <b>action</b> from the Dictionary, then <b>If</b> it <b>is</b> <b>add</b>:</li>
            <li>Inside the If: <b>Get Dictionary Value</b> for <b>title</b>, another for <b>due</b>, then <b>Get Dates from Input</b> on <b>due</b>.</li>
            <li>Still inside: <b>Add New Reminder</b> with the title, turn on <b>Remind Me</b> → <b>At Time</b> → the Dates, and put the <b>tag</b> value in <b>Notes</b>.</li>
            <li>Come back here and tap <b>Test</b>. The full guide is in the app’s repository under docs/setup/iphone-reminders.md.</li>
          </ol>
        </details>
      ) : null}
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

        <RemindersSection />

        <AccountSection />
      </div>
    </div>
  );
};
