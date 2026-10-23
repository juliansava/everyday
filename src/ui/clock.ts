/** Dev only: `?speed=20` runs workout clocks 20× faster so long rides can be tested quickly. */
export const SPEED = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);

const origin = Date.now();

export const now = (): number => origin + (Date.now() - origin) * SPEED;
