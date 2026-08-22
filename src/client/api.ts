import type { CutParamsView } from './prefs.js'

export interface ProjectSummary {
  id: string
  name: string
  videoPath: string
  durationSec: number
  shotCount: number
  updatedAt: number
  cutParams?: CutParamsView
  shotStyle?: 'full7' | 'simple'
  scriptMaster?: string
  storyboardMaster?: string
  extractPrompt?: string
  mergePrompt?: string
  hasScript?: boolean
  hasStoryboard?: boolean
}

function withCwd(path: string, cwd?: string): string {
  if (!cwd) return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}cwd=${encodeURIComponent(cwd)}`
}

async function readJson<T>(res: Response): Promise<T> {
  return await res.json() as T
}

export async function fetchProjects(cwd: string): Promise<ProjectSummary[]> {
  const res = await fetch(withCwd('/bcc/api/projects', cwd))
  const body = await readJson<{ projects?: ProjectSummary[]; error?: string }>(res)
  if (!res.ok) throw new Error(body.error || `加载项目失败 HTTP ${res.status}`)
  return body.projects ?? []
}

export async function fetchProject(id: string, cwd: string): Promise<ProjectSummary> {
  const res = await fetch(withCwd(`/bcc/api/projects/${encodeURIComponent(id)}`, cwd))
  const body = await readJson<ProjectSummary & { shots?: unknown[]; error?: string }>(res)
  if (!res.ok) throw new Error(body.error || `加载项目失败 HTTP ${res.status}`)
  return {
    ...body,
    shotCount: body.shotCount ?? (Array.isArray(body.shots) ? body.shots.length : 0),
  }
}

export async function patchProject(
  id: string,
  cwd: string,
  patch: {
    videoPath?: string
    cutParams?: CutParamsView
    shotStyle?: 'full7' | 'simple'
    scriptMaster?: string
    storyboardMaster?: string
    extractPrompt?: string
    mergePrompt?: string
  },
): Promise<ProjectSummary> {
  const res = await fetch(withCwd(`/bcc/api/projects/${encodeURIComponent(id)}`, cwd), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const body = await readJson<ProjectSummary & { error?: string }>(res)
  if (!res.ok) throw new Error(body.error || `保存项目失败 HTTP ${res.status}`)
  return body
}

export function mediaUrl(file: string, cwd: string): string {
  return `/bcc/media?path=${encodeURIComponent(file)}&cwd=${encodeURIComponent(cwd)}&video=1`
}
