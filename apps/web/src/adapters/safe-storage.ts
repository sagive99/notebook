/** localStorage access that degrades to no-ops where storage is unavailable (private mode, disabled). */
export const safeStorage = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);

      return true;
    } catch {
      return false;
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing stored, nothing to remove.
    }
  },
};
