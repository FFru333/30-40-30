import { useEffect, useState } from 'react';
import { IconList, IconPeople, IconPlate } from '../ui/icons';
import { Composer } from '../features/composer/Composer';
import { FoodsScreen } from '../features/foods/FoodsScreen';
import { ProfilesScreen } from '../features/profiles/ProfilesScreen';

const ROUTES = [
  { path: 'pasto', label: 'Pasto', Icon: IconPlate },
  { path: 'alimenti', label: 'Alimenti', Icon: IconList },
  { path: 'profili', label: 'Profili', Icon: IconPeople },
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

  return (
    <div className="app">
      <main className="main">
        {route === 'pasto' && <Composer />}
        {route === 'alimenti' && <FoodsScreen />}
        {route === 'profili' && <ProfilesScreen />}
      </main>
      <nav className="tabs" aria-label="Sezioni">
        {ROUTES.map((r) => (
          <a key={r.path} href={`#${r.path}`} className={`tabs__a ${route === r.path ? 'is-on' : ''}`} aria-current={route === r.path ? 'page' : undefined}>
            <r.Icon />
            <span>{r.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
