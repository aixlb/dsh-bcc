import type { BccShot } from './types.js'

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 用显式切点秒数覆盖镜头边界（含 0，升序，不含片尾）。 */
export function shotsFromCutTimes(
  cutTimesSec: number[],
  durationSec: number,
  existing?: BccShot[],
): BccShot[] {
  const unique = [...new Set(cutTimesSec.filter((t) => Number.isFinite(t) && t >= 0 && t < durationSec))]
    .sort((a, b) => a - b)
  if (unique[0] !== 0) unique.unshift(0)
  return unique.map((start, i) => {
    const end = i < unique.length - 1 ? unique[i + 1] : durationSec
    const prev = existing?.find((s) => Math.abs(s.startSec - start) < 0.05)
    return {
      index: i + 1,
      startSec: round2(start),
      endSec: round2(end),
      thumbT: prev?.thumbT,
      score: prev?.score ?? 0,
      kind: prev?.kind,
      frame: prev?.frame,
    }
  })
}
