import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { BccProject, BccShot, CutParams } from '../lib/types.js'

const ROOT_NAME = '.dsh-bcc'
const PROJECTS_DIR = 'projects'

export function dataRoot(cwd = process.cwd()): string {
  return path.resolve(cwd, ROOT_NAME)
}

export function projectsDir(cwd = process.cwd()): string {
  return path.join(dataRoot(cwd), PROJECTS_DIR)
}

export function projectDir(id: string, cwd = process.cwd()): string {
  return path.join(projectsDir(cwd), id)
}

function projectJsonPath(id: string, cwd = process.cwd()): string {
  return path.join(projectDir(id, cwd), 'project.json')
}

export async function ensureRoot(cwd = process.cwd()): Promise<void> {
  await fs.mkdir(projectsDir(cwd), { recursive: true })
}

export async function listProjects(cwd = process.cwd()): Promise<BccProject[]> {
  if (!existsSync(projectsDir(cwd))) return []
  const entries = await fs.readdir(projectsDir(cwd), { withFileTypes: true })
  const out: BccProject[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      out.push(await loadProject(entry.name, cwd))
    } catch {
      /* skip broken */
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadProject(id: string, cwd = process.cwd()): Promise<BccProject> {
  const raw = await fs.readFile(projectJsonPath(id, cwd), 'utf-8')
  return JSON.parse(raw) as BccProject
}

export async function saveProject(project: BccProject, cwd = process.cwd()): Promise<BccProject> {
  const next = { ...project, updatedAt: Date.now() }
  const dir = projectDir(next.id, cwd)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(projectJsonPath(next.id, cwd), JSON.stringify(next, null, 2), 'utf-8')
  return next
}

export async function createProject(input: {
  name?: string
  videoPath: string
  durationSec: number
  cutParams: CutParams
  shots?: BccShot[]
  framesDir?: string
  cwd?: string
}): Promise<BccProject> {
  const cwd = input.cwd ?? process.cwd()
  await ensureRoot(cwd)
  const id = randomUUID()
  const videoPath = path.resolve(input.videoPath)
  const name = input.name?.trim() || path.basename(videoPath).replace(/\.[^.]+$/, '') || '未命名'
  const framesDir = input.framesDir
    ? path.resolve(input.framesDir)
    : path.join(projectDir(id, cwd), 'frames')
  const project: BccProject = {
    id,
    name,
    videoPath,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    durationSec: input.durationSec,
    cutParams: input.cutParams,
    shots: input.shots ?? [],
    framesDir,
  }
  return saveProject(project, cwd)
}

export async function updateProjectShots(
  id: string,
  shots: BccShot[],
  extra: Partial<BccProject> = {},
  cwd = process.cwd(),
): Promise<BccProject> {
  const current = await loadProject(id, cwd)
  return saveProject({ ...current, ...extra, shots }, cwd)
}

export async function findProjectByVideo(videoPath: string, cwd = process.cwd()): Promise<BccProject | null> {
  const abs = path.resolve(videoPath)
  const all = await listProjects(cwd)
  return all.find((p) => path.resolve(p.videoPath) === abs) ?? null
}
