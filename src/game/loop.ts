export const STEP = 1 / 30;

// shortcut: excess hidden-tab time is discarded; network rooms must use server ticks.
export function advance(
  accumulator: number,
  elapsed: number,
  tick: () => void,
): number {
  if (!Number.isFinite(elapsed) || elapsed < 0) return accumulator;
  accumulator += Math.min(elapsed, 0.25);
  while (accumulator >= STEP) {
    tick();
    accumulator -= STEP;
  }
  return accumulator;
}
