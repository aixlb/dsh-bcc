import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { captureScriptSamples } from '../src/lib/script-frames.js'
import { getVideoInfo } from '../src/lib/video.js'

function which(bin: string): string | null {
  const ext = process.platform === 'win32' && !bin.endsWith('.exe') ? `${bin}.exe` : bin
  const parts = (process.env.PATH ?? '').split(path.delimiter)
  for (const dir of parts) {
    const candidate = path.join(dir, ext)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })
    let err = ''
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${bin} exited ${code}: ${err.slice(-400)}`))
    })
  })
}

test('captureScriptSamples writes timestamped jpegs for a synthetic clip', { timeout: 90_000 }, async (t) => {
  const ffmpeg = process.env.BCC_FFMPEG_PATH || which('ffmpeg')
  const ffprobe = process.env.BCC_FFPROBE_PATH || which('ffprobe')
  if (!ffmpeg || !ffprobe) {
    t.skip('ffmpeg/ffprobe not on PATH')
    return
  }
  process.env.BCC_FFMPEG_PATH = ffmpeg
  process.env.BCC_FFPROBE_PATH = ffprobe

  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-bcc-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const video = path.join(dir, 'clip.mp4')
  await run(ffmpeg, [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=blue:s=320x180:d=4',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-t', '4',
    video,
  ])

  const info = await getVideoInfo(video)
  assert.ok(info.durationSec > 3.5 && info.durationSec < 4.5, `duration ${info.durationSec}`)

  const framesDir = path.join(dir, 'script-frames')
  const samples = await captureScriptSamples({
    videoPath: video,
    durationSec: info.durationSec,
    shots: [{ index: 1, startSec: 0, endSec: info.durationSec, score: 0 }],
    outputDir: framesDir,
    intervalSec: 1.5,
    maxPerShot: 8,
  })
  assert.ok(samples.length >= 2, `expected several samples, got ${samples.length}`)
  const first = await readFile(samples[0].path)
  assert.equal(first[0], 0xff)
  assert.equal(first[1], 0xd8)
})
