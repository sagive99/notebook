import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'today' }
  | { name: 'spaces' }
  | { name: 'space'; id: string }
  | { name: 'space-settings'; id: string }
  | { name: 'new-space' }
  | { name: 'people' }
  | { name: 'search' }
  | { name: 'customize' };

const ID = /^[\w-]{1,64}$/u;

export const parseRoute = (hash: string): Route => {
  const [name = '', id = ''] = hash.replace(/^#\/?/u, '').split('/');

  switch (name) {
    case 'spaces':
      return { name: 'spaces' };
    case 'space':
      return ID.test(id) ? { name: 'space', id } : { name: 'spaces' };
    case 'space-settings':
      return ID.test(id) ? { name: 'space-settings', id } : { name: 'spaces' };
    case 'new-space':
      return { name: 'new-space' };
    case 'people':
      return { name: 'people' };
    case 'search':
      return { name: 'search' };
    case 'customize':
      return { name: 'customize' };
    default:
      return { name: 'today' };
  }
};

export const href = (route: Route): string => {
  switch (route.name) {
    case 'space':
    case 'space-settings':
      return `#/${route.name}/${route.id}`;
    default:
      return `#/${route.name}`;
  }
};

export const navigate = (route: Route): void => {
  window.location.hash = href(route);
};

export const useRoute = (): Route => {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      document.querySelector('.app-main')?.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);

    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
};
