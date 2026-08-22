import type { BccShot } from './types.js'

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 用显式切点秒数覆盖镜头边界（含 0，升序，不含片尾）。 */
/**
 * Evenly spaced cut times for 拆剧本 interval mode.
 * Always includes 0 and covers the full duration; if the raw count would
 * exceed maxShots, the step stretches so the tail is not dropped.
 */
export function intervalCutTimes(
  durationSec: number,
  intervalSec: number,
  maxShots = 1200,
): number[] {
  const duration = Math.max(0.1, durationSec)
  const cap = Math.max(1, Math.floor(maxShots))
  let step = Math.max(0.2, intervalSec)
  const raw = Math.floor(duration / step) + 1
  if (raw > cap) step = duration / cap
  const times: number[] = []
  for (let t = 0; t < duration - 0.02; t += step) {
    times.push(round2(t))
    if (times.length >= cap) break
  }
  if (times.length === 0) times.push(0)
  else if (times[0] !== 0) times.unshift(0)
  return times
}

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
