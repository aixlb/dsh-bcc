import path from 'node:path'
import fs from 'node:fs/promises'
import type { CutParams, DetectedShot, BccShot, SceneScorePoint, StoryboardCapturedFrame } from './types.js'
import { round2, shotsFromCutTimes } from './cuts.js'

export { round2, shotsFromCutTimes } from './cuts.js'
import { smartDetect } from './smart-cut.js'
import {
  detectShots,
  detectShotsWithSeries,
  downsampleSeries,
  extractFrame,
  SCENE_SERIES_MAX_POINTS,
  type DetectParams,
} from './storyboard.js'
import { getVideoInfo } from './video.js'

export interface DetectAndCaptureOptions {
  videoPath: string
  framesDir?: string
  cutParams: CutParams
  maxShots?: number
  signal?: AbortSignal
  computeSceneSeries?: boolean
  onProgress?: (ev: {
    phase: 'detecting' | 'capturing'
    current?: number
    total?: number
    message: string
    frame?: StoryboardCapturedFrame
    series?: SceneScorePoint[]
    durationSec?: number
    seriesThreshold?: number
  }) => void
  log?: (msg: string) => void
}

export interface DetectAndCaptureResult {
  detected: DetectedShot[]
  framePaths: string[]
  sceneSeries?: SceneScorePoint[]
  durationSec?: number
  seriesThreshold: number
}

function capShots(shots: DetectedShot[], maxShots: number): DetectedShot[] {
  if (shots.length <= maxShots) return shots
  const first = shots[0]
  const rest = shots
    .slice(1)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxShots - 1)
    .sort((a, b) => a.timestamp - b.timestamp)
  return [first, ...rest]
}

export async function detectAndCaptureShots(opts: DetectAndCaptureOptions): Promise<DetectAndCaptureResult> {
  const {
    videoPath,
    framesDir,
    cutParams,
    maxShots = 200,
    signal,
    computeSceneSeries = false,
    onProgress,
    log = () => {},
  } = opts

  onProgress?.({ phase: 'detecting', message: '分析镜头切换点...' })

  let detected: DetectedShot[]
  let sceneSeries: SceneScorePoint[] | undefined
  let durationSec: number | undefined
  let seriesThreshold: number

  if (cutParams.method === 'smart') {
    seriesThreshold = cutParams.smart_hard_min / 255
    log(
      `镜头切分(smart): hardMin=${cutParams.smart_hard_min} hardRatio=${cutParams.smart_hard_ratio} minGap=${cutParams.smart_min_gap}`,
    )
    const r = await smartDetect(
      videoPath,
      {
        hardMin: cutParams.smart_hard_min,
        hardRatio: cutParams.smart_hard_ratio,
        minGap: cutParams.smart_min_gap,
      },
      signal,
    )
    detected = capShots(
      r.shots.map((s) => ({ timestamp: s.start, score: s.score, thumbT: s.thumbT, kind: s.kind })),
      maxShots,
    )
    durationSec = r.duration
    if (computeSceneSeries) sceneSeries = downsampleSeries(r.series, SCENE_SERIES_MAX_POINTS)
    const kinds = r.cuts.reduce<Record<string, number>>((acc, c) => {
      acc[c.kind] = (acc[c.kind] ?? 0) + 1
      return acc
    }, {})
    log(`smart 切出 ${detected.length} 镜（切点: ${Object.entries(kinds).map(([k, n]) => `${k}×${n}`).join(' ') || '无'}）`)
  } else {
    seriesThreshold = cutParams.scene_threshold
    const detectParams: DetectParams = { threshold: cutParams.scene_threshold, maxShots }
    log(`镜头切分(scene): threshold=${detectParams.threshold}`)
    if (computeSceneSeries) {
      try {
        const r = await detectShotsWithSeries(videoPath, detectParams, signal)
        detected = r.shots
        sceneSeries = r.series
      } catch (err: unknown) {
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
        const message = err instanceof Error ? err.message : String(err)
        log(`差异曲线检测失败，回退镜头检测: ${message}`)
        detected = await detectShots(videoPath, detectParams, signal)
      }
    } else {
      detected = await detectShots(videoPath, detectParams, signal)
    }
    if (sceneSeries?.length) durationSec = sceneSeries[sceneSeries.length - 1].t
  }
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
  if (durationSec == null) {
    durationSec = (await getVideoInfo(videoPath)).durationSec
  }
  log(`检测到 ${detected.length} 个镜头`)
  onProgress?.({
    phase: 'detecting',
    message: `检测到 ${detected.length} 个镜头`,
    total: detected.length,
    series: sceneSeries,
    durationSec,
    seriesThreshold,
  })

  const framePaths: string[] = []
  if (framesDir) {
    await fs.mkdir(framesDir, { recursive: true })
    const total = detected.length
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      const t = detected[i].timestamp
      const grabT = detected[i].thumbT ?? t
      const framePath = await extractFrame(videoPath, grabT, framesDir)
      framePaths.push(framePath)
      onProgress?.({
        phase: 'capturing',
        current: i + 1,
        total,
        message: `截图 ${i + 1}/${total}`,
        frame: { index: i, path: framePath, timestamp: t, score: detected[i].score, kind: detected[i].kind },
      })
      log(`[${i + 1}/${total}] 截图 t=${grabT.toFixed(2)}s -> ${path.basename(framePath)}`)
    }
  }

  return { detected, framePaths, sceneSeries, durationSec, seriesThreshold }
}

export function toBccShots(
  detected: DetectedShot[],
  durationSec: number,
  framePaths: string[],
): BccShot[] {
  return detected.map((d, i) => {
    const next = detected[i + 1]
    return {
      index: i + 1,
      startSec: round2(d.timestamp),
      endSec: round2(next ? next.timestamp : durationSec),
      thumbT: d.thumbT != null ? round2(d.thumbT) : undefined,
      score: d.score,
      kind: d.kind,
      frame: framePaths[i],
    }
  })
}


