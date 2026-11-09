import { addItem, blockedCount, openSpaceItems, scheduleItem, spaceItems, waitingCount, withoutWork } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook, useImportantEmails, useServices } from '../../state/hooks';
import { ItemRow } from '../components/ItemRow';
import { Card, Empty } from '../components/primitives';
import { receivedLabel, SPACE_COLORS } from '../format';
import { ChevronRightIcon, ExternalIcon, MailIcon, PeopleIcon } from '../icons';
import { href } from '../router';

export const TeamBlock = () => {
  const { document } = useNotebook();
  const count = waitingCount(document);
  const blocked = blockedCount(document);

  return (
    <a class="card link-card" href={href({ name: 'people' })}>
      <span class="link-card__icon" style={{ background: SPACE_COLORS.orange.bg, color: SPACE_COLORS.orange.fg }}><PeopleIcon size={18} /></span>
      <span class="link-card__body">
        <span class="link-card__title">Team · {count === 0 ? 'nothing waiting' : `waiting on ${count}`}</span>
        <span class="link-card__meta">{blocked > 0 ? `${blocked} blocked · ` : ''}Open tasks linked to people</span>
      </span>
      <ChevronRightIcon size={18} />
    </a>
  );
};

export const GmailBlock = ({ today }: { today: IsoDate }) => {
  const services = useServices();
  const { document, run } = useNotebook();
  const { state, granted, reload } = useImportantEmails(true);
  const [error, setError] = useState<string | null>(null);
  const converted = new Set(Object.values(document.items).filter((item) => !item.deleted && item.sourceEmailId).map((item) => item.sourceEmailId));

  const allow = async () => {
    setError(null);

    try {
      await services.connectGmail();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Gmail access was not granted.');
    }
  };

  const emails = state.kind === 'ready' ? state.data.filter((email) => !converted.has(email.id)) : [];

  return (
    <Card>
      <div class="card__head"><h2 class="card__title">Important in Gmail</h2><MailIcon size={16} /></div>
      {!services.mail ? <Empty>Gmail needs the Google setup first.</Empty> : null}
      {services.mail && !granted ? (
        <div class="card__foot"><span class="card__meta">{error ?? 'Allow read-only Gmail access to see new important emails and turn them into tasks.'}</span><button type="button" class="soft-button" onClick={allow}>Allow</button></div>
      ) : null}
      {state.kind === 'error' ? <p class="inline-error" role="alert">{state.message} <button type="button" class="link-button" onClick={reload}>Retry</button></p> : null}
      {state.kind === 'ready' && emails.length === 0 ? <Empty>No new important emails this week.</Empty> : null}
      <ul class="mail-list">
        {emails.map((email) => (
          <li key={email.id} class={email.unread ? 'mail mail--unread' : 'mail'}>
            <span class="mail__body">
              <span class="mail__subject" dir="auto">{email.unread ? <span class="mail__dot" aria-label="Unread" role="img" /> : null}{email.subject}</span>
              <span class="mail__from"><span dir="auto">{email.from}</span>{email.receivedAt !== null ? ` · ${receivedLabel(email.receivedAt, today)}` : ''}</span>
            </span>
            <a class="icon-button" href={email.link} target="_blank" rel="noopener noreferrer" aria-label={`Open "${email.subject}" in Gmail`}><ExternalIcon size={16} /></a>
            <button type="button" class="soft-button" onClick={() => run((current, context) => addItem(current, { kind: 'task', text: email.subject, day: today, sourceEmailId: email.id }, context).document)}>→ Task</button>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export const BacklogPickBlock = ({ today, hideWork = false }: { today: IsoDate; hideWork?: boolean }) => {
  const { document, run } = useNotebook();
  const [index, setIndex] = useState(0);
  const backlogId = document.settings.backlogSpaceId;
  const ideas = backlogId ? withoutWork(document, spaceItems(document, backlogId), hideWork).filter((item) => !item.done && item.day === null) : [];
  const idea = ideas.length > 0 ? ideas[index % ideas.length] : undefined;

  return (
    <Card>
      <div class="card__head"><h2 class="card__title">From your backlog</h2>{backlogId ? <a class="link-button" href={href({ name: 'space', id: backlogId })}>Open</a> : null}</div>
      {idea ? (
        <div class="pick">
          <p class="pick__text" dir="auto">{idea.text}</p>
          <div class="card__foot">
            <button type="button" class="link-button" disabled={ideas.length < 2} onClick={() => setIndex(index + 1)}>Another one</button>
            <button type="button" class="pill-button pill-button--small" onClick={() => run((current, context) => scheduleItem(current, idea.id, today, context))}>→ Today</button>
          </div>
        </div>
      ) : <Empty>{backlogId ? 'The backlog is empty.' : 'Pick a backlog space in Customize Today.'}</Empty>}
    </Card>
  );
};

export const SpaceBlock = ({ spaceId, today, hideWork = false }: { spaceId: string; today: IsoDate; hideWork?: boolean }) => {
  const { document } = useNotebook();
  const space = document.spaces[spaceId];

  if (!space || space.deleted) {
    return null;
  }

  const open = withoutWork(document, openSpaceItems(document, spaceId), hideWork);

  return (
    <Card>
      <div class="card__head"><h2 class="card__title" dir="auto">{space.name}</h2><a class="link-button" href={href({ name: 'space', id: space.id })}>Open</a></div>
      <div class="item-list">{open.slice(0, 5).map((item) => <ItemRow key={item.id} item={item} today={today} showDay />)}</div>
      {open.length === 0 ? <Empty>Nothing open here.</Empty> : null}
      {open.length > 5 ? <p class="card__meta">+{open.length - 5} more</p> : null}
    </Card>
  );
};
