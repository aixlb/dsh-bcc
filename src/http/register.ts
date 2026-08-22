import fs from 'node:fs/promises'
import { createReadStream, createWriteStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { listProjects, loadProject, dataRoot } from '../store/projects.js'

type WebServer = {
  register: (route: {
    kind: 'prefix' | 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }) => () => void
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
        if (url.pathname === '/bcc/api/projects' && req.method === 'GET') {
          const projects = await listProjects(cwd)
          writeJson(res, 200, { projects })
          return
        }
        const one = url.pathname.match(/^\/bcc\/api\/projects\/([^/]+)$/)
        if (one && req.method === 'GET') {
          writeJson(res, 200, await loadProject(decodeURIComponent(one[1]), cwd))
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
