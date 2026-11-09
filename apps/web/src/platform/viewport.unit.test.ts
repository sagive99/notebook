import { describe, expect, it } from 'vitest';
import { syncViewport } from './viewport';

const fakeHost = () => {
  const listeners = new Map<string, () => void>();
  const state = { scrollY: 0, scrolledTo: [] as Array<[number, number]>, props: new Map<string, string>() };
  const viewport = {
    height: 664,
    offsetTop: 0,
    addEventListener: (type: string, listener: () => void) => void listeners.set(type, listener),
    removeEventListener: (type: string) => void listeners.delete(type),
  };
  const host = {
    visualViewport: viewport,
    get scrollY() {
      return state.scrollY;
    },
    scrollTo: (x: number, y: number) => {
      state.scrolledTo.push([x, y]);
      state.scrollY = y;
    },
    root: { style: { setProperty: (name: string, value: string) => void state.props.set(name, value) } },
  };

  return { host, viewport, listeners, state };
};

describe('syncViewport', () => {
  it('follows the visible height and undoes the page shift once the keyboard closes', () => {
    const { host, viewport, listeners, state } = fakeHost();
    const stop = syncViewport(host);

    expect(state.props.get('--app-height')).toBe('664px');

    viewport.height = 380;
    viewport.offsetTop = 120;
    state.scrollY = 120;
    listeners.get('resize')?.();

    expect(state.props.get('--app-height')).toBe('380px');
    expect(state.scrolledTo).toEqual([]);

    viewport.height = 664;
    viewport.offsetTop = 0;
    listeners.get('resize')?.();

    expect(state.props.get('--app-height')).toBe('664px');
    expect(state.scrolledTo).toEqual([[0, 0]]);

    stop();

    expect(listeners.size).toBe(0);
  });

  it('does nothing without a visual viewport', () => {
    const { host } = fakeHost();

    expect(() => syncViewport({ ...host, visualViewport: null })()).not.toThrow();
  });
});
