import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { BccShot, ScriptSample } from './types.js'
import { extractFrame, getFfmpegBin } from './storyboard.js'
import { formatHMS } from './video.js'

export const SCRIPT_SAMPLE_DEFAULTS = {
  intervalSec: 1.5,
  maxPerShot: 8,
  maxTotal: 200,
}

export interface ScriptSamplePlan {
  t: number
  shotIndex: number
}

export function planScriptSampleTimes(opts: {
  durationSec: number
  shots?: Array<Pick<BccShot, 'index' | 'startSec' | 'endSec' | 'thumbT'>>
  intervalSec?: number
  maxPerShot?: number
  maxTotal?: number
}): ScriptSamplePlan[] {
  const interval = opts.intervalSec ?? SCRIPT_SAMPLE_DEFAULTS.intervalSec
  const maxPerShot = opts.maxPerShot ?? SCRIPT_SAMPLE_DEFAULTS.maxPerShot
  const maxTotal = opts.maxTotal ?? SCRIPT_SAMPLE_DEFAULTS.maxTotal
  const duration = Math.max(0.1, opts.durationSec)
  const shots = opts.shots && opts.shots.length > 0
    ? opts.shots
    : [{ index: 1, startSec: 0, endSec: duration }]

  const samples: ScriptSamplePlan[] = []
  for (const shot of shots) {
    const start = Math.max(0, shot.startSec)
    const end = Math.max(start + 0.05, Math.min(duration, shot.endSec))
    const len = end - start
    const times: number[] = []
    if (len <= 1.2) {
      const mid = shot.thumbT != null ? clamp(shot.thumbT, start, end - 0.01) : start + len / 2
      times.push(mid)
    } else {
      const first = start + Math.min(0.25, len * 0.08)
      const last = end - Math.min(0.25, len * 0.08)
      times.push(first)
      const room = Math.max(0, maxPerShot - 2)
      const innerSlots = Math.floor(len / interval) - 1
      const extra = Math.min(room, Math.max(0, innerSlots))
      if (extra > 0 && last > first) {
        const step = (last - first) / (extra + 1)
        for (let i = 1; i <= extra; i++) times.push(first + step * i)
      }
      if (last - first > 0.35) times.push(last)
    }
    const uniq = [...new Set(times.map((t) => Math.round(t * 100) / 100))]
      .filter((t) => t >= start && t < end)
      .sort((a, b) => a - b)
      .slice(0, maxPerShot)
    for (const t of uniq) samples.push({ t, shotIndex: shot.index })
  }

  if (samples.length <= maxTotal) return samples
  const stride = Math.ceil(samples.length / maxTotal)
  const kept: ScriptSamplePlan[] = []
  for (let i = 0; i < samples.length; i++) {
    if (i === 0 || i === samples.length - 1 || i % stride === 0) kept.push(samples[i])
  }
  return kept
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function resolveFontFile(): string | null {
  const candidates = process.platform === 'win32'
    ? [
      'C:/Windows/Fonts/msyh.ttc',
      'C:/Windows/Fonts/msyh.ttf',
      'C:/Windows/Fonts/arial.ttf',
      'C:/Windows/Fonts/simhei.ttf',
    ]
    : process.platform === 'darwin'
      ? ['/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf']
      : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf']
  return candidates.find((p) => existsSync(p)) ?? null
}

function drawtextFilter(timestamp: number): string | null {
  const font = resolveFontFile()
  if (!font) return null
  const label = formatHMS(timestamp).replace(/:/g, '\\:')
  const fontfile = font.replace(/\\/g, '/').replace(/:/g, '\\:')
  return `scale=854:-2,drawtext=fontfile='${fontfile}':text='${label}':x=16:y=16:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.7`
}

async function runFfmpeg(args: string[]): Promise<void> {
  const bin = await getFfmpegBin()
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })
    let err = ''
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))
    })
  })
}

export async function extractScriptFrame(
  videoPath: string,
  timestamp: number,
  outputDir: string,
): Promise<string> {
  const outputPath = path.join(outputDir, `script_${String(Math.round(timestamp * 1000)).padStart(8, '0')}.jpg`)
  const vf = drawtextFilter(timestamp)
  if (vf) {
    try {
      await runFfmpeg([
        '-y',
        '-ss', String(timestamp),
        '-i', videoPath,
        '-vframes', '1',
        '-q:v', '2',
        '-vf', vf,
        outputPath,
      ])
      return outputPath
    } catch {
      /* fall through: some ffmpeg builds lack libfreetype */
    }
  }
  return extractFrame(videoPath, timestamp, outputDir)
}

export async function captureScriptSamples(opts: {
  videoPath: string
  durationSec: number
  shots: BccShot[]
  outputDir: string
  intervalSec?: number
  maxPerShot?: number
  maxTotal?: number
  signal?: AbortSignal
  onProgress?: (current: number, total: number) => void
}): Promise<ScriptSample[]> {
  const plans = planScriptSampleTimes({
    durationSec: opts.durationSec,
    shots: opts.shots,
    intervalSec: opts.intervalSec,
    maxPerShot: opts.maxPerShot,
    maxTotal: opts.maxTotal,
  })
  await mkdir(opts.outputDir, { recursive: true })
  const out: ScriptSample[] = []
  for (let i = 0; i < plans.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    const plan = plans[i]
    const file = await extractScriptFrame(opts.videoPath, plan.t, opts.outputDir)
    out.push({ index: i + 1, t: plan.t, shotIndex: plan.shotIndex, path: file })
    opts.onProgress?.(i + 1, plans.length)
  }
  return out
}
