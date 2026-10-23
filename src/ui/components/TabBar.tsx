import { useData } from '../data';

const TABS = [
  { name: 'today', label: 'Today' },
  { name: 'progress', label: 'Progress' },
  { name: 'calendar', label: 'Calendar' },
] as const;

export function TabBar() {
  const { route, go } = useData();
  const active = route.name === 'day' ? 'calendar' : route.name;
  return (
    <nav class="tabbar">
      {TABS.map((t) => (
        <button key={t.name} class={active === t.name ? 'tab active' : 'tab'} onClick={() => go({ name: t.name })}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
