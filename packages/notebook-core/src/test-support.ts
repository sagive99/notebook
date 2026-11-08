import type { CommandContext } from './types';

/** Deterministic clock and id source for unit tests. */
export const testContext = (iso = '2026-11-09T09:00:00'): CommandContext & { advance: (minutes: number) => void } => {
  const state = { now: new Date(iso), counter: 0 };

  return {
    get now() {
      return state.now;
    },
    newId: () => {
      state.counter += 1;

      return `id-${state.counter}`;
    },
    advance: (minutes: number) => {
      state.now = new Date(state.now.getTime() + minutes * 60_000);
    },
  };
};
