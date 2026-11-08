import { describe, expect, it } from 'vitest';
import { defaultCaptureTarget, parseCapture } from './capture';
import { addPerson, createDocument } from './document';
import { livePeople } from './selectors';
import { testContext } from './test-support';

const peopleFixture = () => {
  const context = testContext();
  const withOmer = addPerson(createDocument(context), 'Omer', context).document;
  const withDana = addPerson(withOmer, 'Dana Levi', context).document;

  return livePeople(withDana);
};

describe('parseCapture', () => {
  const now = new Date('2026-11-09T21:30:00');

  it('links a mentioned person and keeps their name in the text', () => {
    const people = peopleFixture();
    const parsed = parseCapture('Ask @omer how the deploy went', people, now);

    expect(parsed.personId).toBe(people.find((person) => person.name === 'Omer')?.id);
    expect(parsed.text).toBe('Ask omer how the deploy went');
  });

  it('prefers the longest matching name', () => {
    const people = peopleFixture();
    const parsed = parseCapture('CR for @Dana Levi', people, now);

    expect(parsed.personId).toBe(people.find((person) => person.name === 'Dana Levi')?.id);
  });

  it('reads tomorrow in English and Hebrew', () => {
    expect(parseCapture('call the bank tomorrow', [], now)).toMatchObject({ day: '2026-11-10', text: 'call the bank' });
    expect(parseCapture('להתקשר לבנק מחר', [], now)).toMatchObject({ day: '2026-11-10', text: 'להתקשר לבנק' });
  });

  it('reads times and tags', () => {
    expect(parseCapture('sync with infra at 9:05 #work #Work', [], now)).toMatchObject({ time: '09:05', tags: ['work'], text: 'sync with infra' });
    expect(parseCapture('standup at 10', [], now)).toMatchObject({ time: '10:00', text: 'standup' });
  });

  it('leaves plain prose alone', () => {
    expect(parseCapture('read about todays outage email', [], now)).toEqual({ text: 'read about todays outage email', personId: null, day: null, time: null, tags: [] });
  });
});

describe('defaultCaptureTarget', () => {
  it('sends evening thoughts to tomorrow', () => {
    expect(defaultCaptureTarget(new Date('2026-11-09T17:59:00'), '18:00')).toBe('today');
    expect(defaultCaptureTarget(new Date('2026-11-09T18:00:00'), '18:00')).toBe('tomorrow');
  });
});
