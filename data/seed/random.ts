/**
 * Seeded RNG so seed runs are reproducible. Mulberry32 is fine for our needs.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T extends string>(
  rng: () => number,
  dist: Record<T, number>
): T {
  const r = rng();
  let acc = 0;
  for (const k of Object.keys(dist) as T[]) {
    acc += dist[k];
    if (r <= acc) return k;
  }
  return Object.keys(dist)[Object.keys(dist).length - 1] as T;
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}
