/**
 * "Nice" axis ticks: round steps of 1, 2, 2.5 or 5 × 10^n, so axes read
 * $500 / $1K / $1.5K instead of $550 / $1.1K / $1.7K.
 */

function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Ticks covering [min, max] with about `count` round steps.
 * Use the first and last tick as the axis domain.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) max = min + 1;
  const step = niceStep((max - min) / Math.max(1, count - 1));
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
