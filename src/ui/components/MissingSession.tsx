import { useData } from '../data';

export function MissingSession() {
  const { go } = useData();
  return (
    <main class="screen">
      <p>This session couldn't be found.</p>
      <button class="btn" onClick={() => go({ name: 'today' })}>
        Back to today
      </button>
    </main>
  );
}
