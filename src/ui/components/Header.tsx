import type { ComponentChildren } from 'preact';

export function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ComponentChildren;
}) {
  return (
    <header class="header">
      {onBack && (
        <button class="icon-btn" aria-label="Back" onClick={onBack}>
          ←
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </header>
  );
}
