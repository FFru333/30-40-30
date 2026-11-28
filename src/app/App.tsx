import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { MariPopup } from '../ui/Mari';
import { Composer } from '../features/composer/Composer';
import { FoodsScreen } from '../features/foods/FoodsScreen';
import { ProfilesScreen } from '../features/profiles/ProfilesScreen';

const ROUTES = [
  { path: 'pasto', label: 'Pasto' },
  { path: 'alimenti', label: 'Alimenti' },
  { path: 'profili', label: 'Profili' },
] as const;
type Route = (typeof ROUTES)[number]['path'];

function readRoute(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  return (ROUTES.find((r) => r.path === h)?.path ?? 'pasto') as Route;
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const on = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (route !== 'pasto') document.documentElement.dataset.mood = 'plain';
  }, [route]);

  // Contatori in apice, come nel riferimento: elementi nel piatto, alimenti, profili.
  const counts = useLiveQuery(
    async () => ({
      pasto: (await db.drafts.get('current'))?.items.length ?? 0,
      alimenti: await db.foods.count(),
      profili: await db.profiles.count(),
    }),
    [],
  );

  return (
    <div className="app">
      <main className="main">
        {route === 'pasto' && <Composer />}
        {route === 'alimenti' && <FoodsScreen />}
        {route === 'profili' && <ProfilesScreen />}
      </main>
      <MariPopup />
      <nav className="tabs" aria-label="Sezioni">
        {ROUTES.map((r) => (
          <a key={r.path} href={`#${r.path}`} className={`tabs__a ${route === r.path ? 'is-on' : ''}`} aria-current={route === r.path ? 'page' : undefined}>
            {r.label}
            {counts && <sup>{counts[r.path]}</sup>}
          </a>
        ))}
      </nav>
    </div>
  );
}
