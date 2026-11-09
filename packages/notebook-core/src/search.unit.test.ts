import { describe, expect, it } from 'vitest';
import { addItem, addPerson, createDocument, setItemOngoing, toggleItemDone } from './document';
import { highlightParts, quickFilterItems, searchNotebook } from './search';
import { testContext } from './test-support';

const fixture = () => {
  const context = testContext('2026-11-09T09:00:00');
  const omer = addPerson(createDocument(context), 'Omer', context);
  const deploy = addItem(omer.document, { kind: 'task', text: 'Deploy map external layers', personId: omer.person.id }, context);
  const ask = addItem(deploy.document, { kind: 'task', text: 'Ask about the deploy', day: '2026-11-09', time: '09:30', remind: true }, context);
  const note = addItem(ask.document, { kind: 'note', text: 'Prod runs HTTP/2 for the deploy', day: '2026-11-09' }, context);
  const idea = addItem(note.document, { kind: 'idea', text: 'Learn QUIC', tags: ['someday'] }, context);
  const old = addItem(idea.document, { kind: 'task', text: 'Old carried task', day: '2026-11-05' }, context);
  const ongoing = setItemOngoing(old.document, deploy.item.id, true, context);

  return { context, document: ongoing, ids: { deploy: deploy.item.id, ask: ask.item.id } };
};

describe('searchNotebook', () => {
  it('groups matches by type with ongoing first, and finds people by their ongoing work', () => {
    const { document } = fixture();
    const groups = searchNotebook(document, 'DEPLOY');

    expect(groups.tasks.map((item) => item.text)).toEqual(['Deploy map external layers', 'Ask about the deploy']);
    expect(groups.notes.map((item) => item.text)).toEqual(['Prod runs HTTP/2 for the deploy']);
    expect(groups.people.map((hit) => [hit.person.name, hit.ongoing?.text])).toEqual([['Omer', 'Deploy map external layers']]);
    expect(groups.ideas).toEqual([]);
    expect(searchNotebook(document, 'someday').ideas.map((item) => item.text)).toEqual(['Learn QUIC']);
    expect(searchNotebook(document, '  ')).toEqual({ tasks: [], notes: [], ideas: [], people: [], spaces: [] });
  });
});

describe('quickFilterItems', () => {
  it('builds each quick filter from the notebook', () => {
    const { context, document, ids } = fixture();
    const finished = toggleItemDone(document, ids.ask, context);
    const texts = (id: Parameters<typeof quickFilterItems>[1], source = document) => quickFilterItems(source, id, '2026-11-09').map((item) => item.text);

    expect(texts('ongoing')).toEqual(['Deploy map external layers']);
    expect(texts('waiting')).toEqual(['Deploy map external layers']);
    expect(texts('due-today')).toEqual(['Ask about the deploy', 'Prod runs HTTP/2 for the deploy']);
    expect(texts('carried')).toEqual(['Old carried task']);
    expect(texts('reminders')).toEqual(['Ask about the deploy']);
    expect(texts('done-week', finished)).toEqual(['Ask about the deploy']);

    const longAgo = toggleItemDone(document, ids.ask, testContext('2026-10-01T09:00:00'));

    expect(texts('done-week', longAgo)).toEqual([]);
  });
});

describe('highlightParts', () => {
  it('splits text around every case-insensitive match', () => {
    expect(highlightParts('Deploy the deploy', 'deploy')).toEqual([{ text: 'Deploy', match: true }, { text: ' the ', match: false }, { text: 'deploy', match: true }]);
    expect(highlightParts('nothing here', 'x')).toEqual([{ text: 'nothing here', match: false }]);
    expect(highlightParts('anything', '')).toEqual([{ text: 'anything', match: false }]);
  });
});
