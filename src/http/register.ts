import fs from 'node:fs/promises'
import { createReadStream, createWriteStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { listProjects, loadProject, saveProject, dataRoot } from '../store/projects.js'
import type { CutParams } from '../lib/types.js'
import { loadOpenPrompts } from '../lib/prompt-files.js'

type WebServer = {
  register: (route: {
    kind: 'prefix' | 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }) => () => void
}

function summarizeProject(project: Awaited<ReturnType<typeof loadProject>>): Record<string, unknown> {
  return {
    id: project.id,
    name: project.name,
    videoPath: project.videoPath,
    durationSec: project.durationSec,
    shotCount: project.shots.length,
    updatedAt: project.updatedAt,
    cutParams: project.cutParams,
    shotStyle: project.shotStyle ?? null,
    scriptMaster: project.scriptMaster ?? '',
    storyboardMaster: project.storyboardMaster ?? '',
    extractPrompt: project.extractPrompt ?? '',
    mergePrompt: project.mergePrompt ?? '',
    hasScript: !!project.scriptPath,
    hasStoryboard: !!project.storyboardPath,
  }
}

function mergeCutParams(current: CutParams, patch: Partial<CutParams> | undefined): CutParams {
  if (!patch) return current
  return {
    method: patch.method === 'scene' || patch.method === 'smart' || patch.method === 'interval' ? patch.method : current.method,
    scene_threshold: num(patch.scene_threshold, current.scene_threshold),
    smart_hard_min: num(patch.smart_hard_min, current.smart_hard_min),
    smart_hard_ratio: num(patch.smart_hard_ratio, current.smart_hard_ratio),
    smart_min_gap: num(patch.smart_min_gap, current.smart_min_gap),
    interval_sec: num(patch.interval_sec, current.interval_sec ?? 1),
  }
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

async function readJson(req: IncomingMessage, limit = 1_000_000): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(buf)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw) as unknown
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
  res.end(json)
}

function mimeOf(file: string): string {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.mkv') return 'video/x-matroska'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

async function sendRange(req: IncomingMessage, res: ServerResponse, file: string): Promise<void> {
  const stat = statSync(file)
  const range = req.headers.range
  const type = mimeOf(file)
  if (!range) {
    res.writeHead(200, {
      'content-type': type,
      'content-length': stat.size,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
    })
    createReadStream(file).pipe(res)
    return
  }
  const m = range.match(/bytes=(\d*)-(\d*)/)
  if (!m) {
    res.writeHead(416)
    res.end()
    return
  }
  const start = m[1] ? parseInt(m[1], 10) : 0
  const end = m[2] ? parseInt(m[2], 10) : stat.size - 1
  if (start >= stat.size || end >= stat.size) {
    res.writeHead(416, { 'content-range': `bytes */${stat.size}` })
    res.end()
    return
  }
  res.writeHead(206, {
    'content-type': type,
    'content-length': end - start + 1,
    'content-range': `bytes ${start}-${end}/${stat.size}`,
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
  })
  createReadStream(file, { start, end }).pipe(res)
}

export function registerHttp(ctx: Context): void {
  const webServer = (ctx as Context & { webServer?: WebServer }).webServer
  if (!webServer?.register) return

  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: '/bcc/api',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const cwd = url.searchParams.get('cwd') || process.cwd()
        if (url.pathname === '/bcc/api/prompts' && req.method === 'GET') {
          writeJson(res, 200, { ...loadOpenPrompts(), source: 'prompts/*.md' })
          return
        }
        if (url.pathname === '/bcc/api/projects' && req.method === 'GET') {
          const projects = await listProjects(cwd)
          writeJson(res, 200, { projects: projects.map(summarizeProject) })
          return
        }
        const one = url.pathname.match(/^\/bcc\/api\/projects\/([^/]+)$/)
        if (one && req.method === 'GET') {
          writeJson(res, 200, summarizeProject(await loadProject(decodeURIComponent(one[1]), cwd)))
          return
        }
        if (one && req.method === 'POST') {
          const id = decodeURIComponent(one[1])
          const current = await loadProject(id, cwd)
          const patch = await readJson(req) as {
            videoPath?: unknown
            cutParams?: Partial<CutParams>
            shotStyle?: unknown
            scriptMaster?: unknown
            storyboardMaster?: unknown
            extractPrompt?: unknown
            mergePrompt?: unknown
            name?: unknown
          }
          const next = await saveProject({
            ...current,
            name: typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : current.name,
            videoPath: typeof patch.videoPath === 'string' && patch.videoPath.trim()
              ? path.resolve(patch.videoPath)
              : current.videoPath,
            cutParams: mergeCutParams(current.cutParams, patch.cutParams),
            shotStyle: patch.shotStyle === 'simple' || patch.shotStyle === 'full7' ? patch.shotStyle : current.shotStyle,
            scriptMaster: typeof patch.scriptMaster === 'string' ? patch.scriptMaster : current.scriptMaster,
            storyboardMaster: typeof patch.storyboardMaster === 'string' ? patch.storyboardMaster : current.storyboardMaster,
            extractPrompt: typeof patch.extractPrompt === 'string' ? patch.extractPrompt : current.extractPrompt,
            mergePrompt: typeof patch.mergePrompt === 'string' ? patch.mergePrompt : current.mergePrompt,
          }, cwd)
          writeJson(res, 200, summarizeProject(next))
          return
        }
        if (url.pathname === '/bcc/api/upload' && req.method === 'POST') {
          const rawName = url.searchParams.get('name') || 'video.mp4'
          const safe = path.basename(rawName).replace(/[<>:"|?*\x00-\x1f]/g, '_') || 'video.mp4'
          const dir = path.join(cwd, '.dsh-bcc', 'uploads')
          await fs.mkdir(dir, { recursive: true })
          let dest = path.join(dir, safe)
          if (existsSync(dest)) {
            const ext = path.extname(safe)
            dest = path.join(dir, `${path.basename(safe, ext)}-${Date.now()}${ext}`)
          }
          const declared = Number(req.headers['content-length'] ?? 0)
          if (declared > 8 * 1024 * 1024 * 1024) {
            writeJson(res, 413, { error: '视频超过 8GB' })
            return
          }
          await pipeline(req, createWriteStream(dest))
          const size = (await fs.stat(dest)).size
          writeJson(res, 200, { path: dest, size, name: path.basename(dest) })
          return
        }
        writeJson(res, 404, { error: 'not found' })
      } catch (error) {
        writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-bcc: /bcc/api')

  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: '/bcc/media',
    handler: async (req, res) => {
      try {
        if (req.method !== 'GET') {
          res.writeHead(405)
          res.end()
          return
        }
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const raw = url.searchParams.get('path')
        const cwd = url.searchParams.get('cwd') || process.cwd()
        if (!raw) {
          res.writeHead(400)
          res.end('path required')
          return
        }
        const file = path.resolve(raw)
        const root = dataRoot(cwd)
        const videoOk = url.searchParams.get('video') === '1'
        if (!existsSync(file)) {
          res.writeHead(404)
          res.end('missing')
          return
        }
        if (!videoOk && !isInside(root, file) && !isInside(cwd, file)) {
          res.writeHead(403)
          res.end('forbidden')
          return
        }
        await sendRange(req, res, file)
      } catch (error) {
        res.writeHead(500)
        res.end(error instanceof Error ? error.message : String(error))
      }
    },
  }), 'dsh-bcc: /bcc/media')
}
