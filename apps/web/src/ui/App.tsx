import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BottomNav } from './components/chrome';
import { useRoute } from './router';
import { CustomizeScreen } from './screens/CustomizeScreen';
import { PeopleScreen, SearchScreen } from './screens/OtherScreens';
import { SpaceFormScreen } from './screens/SpaceFormScreen';
import { SpaceScreen } from './screens/SpaceScreen';
import { SpacesScreen } from './screens/SpacesScreen';
import { TodayScreen } from './screens/TodayScreen';
import { CaptureSheet } from './sheets/CaptureSheet';
import { EventSheet } from './sheets/EventSheet';
import { ItemSheet } from './sheets/ItemSheet';
import { PersonSheet } from './sheets/PersonSheet';
import { SheetContext } from './sheets/sheet-context';
import type { SheetControls, SheetRequest } from './sheets/sheet-context';

const Screen = () => {
  const route = useRoute();
  const main = useRef<HTMLElement>(null);

  // The page never scrolls; only <main> does (iOS shell, see apps/web/AGENTS.md), so reset it per route.
  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [route]);

  return (
    <>
      <main class="app-main" ref={main}>
        {route.name === 'today' ? <TodayScreen /> : null}
        {route.name === 'spaces' ? <SpacesScreen /> : null}
        {route.name === 'space' ? <SpaceScreen key={route.id} id={route.id} /> : null}
        {route.name === 'space-settings' ? <SpaceFormScreen key={route.id} id={route.id} /> : null}
        {route.name === 'new-space' ? <SpaceFormScreen /> : null}
        {route.name === 'people' ? <PeopleScreen /> : null}
        {route.name === 'search' ? <SearchScreen /> : null}
        {route.name === 'customize' ? <CustomizeScreen /> : null}
      </main>
      <BottomNav route={route} />
    </>
  );
};

const ActiveSheet = ({ request, close }: { request: SheetRequest; close: () => void }) => {
  switch (request.kind) {
    case 'capture':
      return <CaptureSheet preset={request.preset} onClose={close} />;
    case 'item':
      return <ItemSheet key={request.id} id={request.id} onClose={close} />;
    case 'event':
      return <EventSheet day={request.day} event={request.event} onSaved={request.onSaved} onClose={close} />;
    case 'person':
      return <PersonSheet id={request.id} onClose={close} />;
  }
};

export const App = () => {
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const controls = useMemo<SheetControls>(() => ({ open: setSheet, close: () => setSheet(null) }), []);

  return (
    <SheetContext.Provider value={controls}>
      <div class="app">
        <Screen />
        {sheet ? <ActiveSheet request={sheet} close={controls.close} /> : null}
      </div>
    </SheetContext.Provider>
  );
};
