import { Figure } from '../../art/Figure';
import { DRAWINGS } from '../../art/poses';
import { EXERCISES } from '../../program/exercises';
import type { ExerciseId } from '../../program/types';

export function Gallery() {
  return (
    <main class="screen">
      <h1>Drawings</h1>
      <div class="gallery">
        {(Object.keys(DRAWINGS) as ExerciseId[]).map((id) => (
          <figure key={id} class="card">
            <Figure exerciseId={id} size={140} />
            <figcaption class="small">{EXERCISES[id].name}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
