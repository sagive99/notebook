type ViewportEvents = 'resize' | 'scroll';

/** The slice of the browser this module touches, so tests can drive it without a real iPhone. */
type ViewportHost = {
  visualViewport: {
    height: number;
    offsetTop: number;
    addEventListener(type: ViewportEvents, listener: () => void): void;
    removeEventListener(type: ViewportEvents, listener: () => void): void;
  } | null;
  scrollY: number;
  scrollTo: (x: number, y: number) => void;
  root: { style: { setProperty(name: string, value: string): void } };
};

const browserHost = (): ViewportHost => ({
  visualViewport: window.visualViewport,
  get scrollY() {
    return window.scrollY;
  },
  scrollTo: (x, y) => window.scrollTo(x, y),
  root: document.documentElement,
});

/**
 * Keeps the app shell exactly as tall as the visible viewport (exposed as --app-height) and undoes the
 * page shift iOS can leave behind after the keyboard closes. Returns a cleanup function.
 */
export const syncViewport = (host: ViewportHost = browserHost()): (() => void) => {
  const viewport = host.visualViewport;

  if (!viewport) {
    return () => undefined;
  }

  const apply = () => {
    host.root.style.setProperty('--app-height', `${Math.round(viewport.height)}px`);

    if (viewport.offsetTop === 0 && host.scrollY !== 0) {
      host.scrollTo(0, 0);
    }
  };

  apply();
  viewport.addEventListener('resize', apply);
  viewport.addEventListener('scroll', apply);

  return () => {
    viewport.removeEventListener('resize', apply);
    viewport.removeEventListener('scroll', apply);
  };
};
