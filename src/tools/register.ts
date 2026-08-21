import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { getVideoInfo } from '../lib/video.js'
import { detectAndCaptureShots, round2, shotsFromCutTimes, toBccShots } from '../lib/shots.js'
import { extractFrame } from '../lib/storyboard.js'
import { parseScript } from '../lib/parse-script.js'
import { generateScriptDocx } from '../lib/script-export.js'
import { generateStoryboardXlsx } from '../lib/storyboard.js'
import { buildProjectHtml } from '../lib/html-build.js'
import {
  listMasters,
  resolveMasterId,
  getScriptMasterAddendum,
  getStoryboardMasterAddendum,
} from '../lib/masters.js'
import { DEFAULT_CUT_PARAMS, type CutParams, type StoryboardShot, type ScriptResult } from '../lib/types.js'
import {
  createProject,
  findProjectByVideo,
  listProjects,
  loadProject,
  saveProject,
  updateProjectShots,
} from '../store/projects.js'
import { assertVisionOrHint, RECOMMENDED_MODEL, VISION_REQUIRED_MESSAGE } from '../lib/vision.js'
import type { PluginConfig } from '../config.js'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { JsonValue } from '@deepseek-ai/dsh-session'

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

const MAX_READ_FRAMES = 8

function resolveCutParams(args: Record<string, unknown>, fallback: CutParams): CutParams {
  const method = args.cutMethod === 'scene' || args.cut_method === 'scene' ? 'scene' : (args.cutMethod === 'smart' || args.cut_method === 'smart' ? 'smart' : fallback.method)
  const num = (keys: string[], def: number): number => {
    for (const k of keys) {
      const v = args[k]
      if (typeof v === 'number' && Number.isFinite(v)) return v
    }
    return def
  }
  return {
    method,
    scene_threshold: num(['threshold', 'sceneThreshold'], fallback.scene_threshold),
    smart_hard_min: num(['hardMin', 'hard_min'], fallback.smart_hard_min),
    smart_hard_ratio: num(['hardRatio', 'hard_ratio'], fallback.smart_hard_ratio),
    smart_min_gap: num(['minGap', 'min_gap'], fallback.smart_min_gap),
  }
}

function cwdOf(args: { cwd?: string }): string {
  return args.cwd ? path.resolve(args.cwd) : process.cwd()
}

export function registerTools(ctx: Context, configOf: () => PluginConfig): void {
  ctx.tools.register(defineTool({
    name: 'bcc_probe',
    description: 'Probe a local video file for duration, resolution, codec, fps, and size. Use before 包拆拆 pipelines.',
    parameters: {
      video: { type: 'string', required: true, description: 'Absolute path to the video file' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const video = path.resolve(String(args.video))
      const info = await getVideoInfo(video)
      return asJson({ ...info, path: video })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_shots',
    description:
      'Detect shot cuts in a video (smart or scene) and optionally extract keyframes. Creates or updates a 包拆拆 project. Chat can re-run with larger minGap if cuts are too fine, or smaller if too coarse.',
    parameters: {
      video: { type: 'string', required: true, description: 'Absolute path to the video' },
      projectId: { type: 'string', description: 'Existing project id to update' },
      frames: { type: 'boolean', description: 'Extract keyframes (default true for storyboard)' },
      cutMethod: { type: 'string', enum: ['smart', 'scene'], description: 'Cut method' },
      hardMin: { type: 'number', description: 'smart: minimum hard-cut frame diff (default 5.5; lower = more sensitive)' },
      hardRatio: { type: 'number', description: 'smart: ratio vs local median (default 8)' },
      minGap: { type: 'number', description: 'smart: minimum gap between cuts in seconds (default 0.3)' },
      threshold: { type: 'number', description: 'scene: score threshold 0-1 (default 0.3)' },
      maxShots: { type: 'number', description: 'Max shots (default 200)' },
      cwd: { type: 'string', description: 'Workspace root; default process cwd' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    presentResult: (_args, result) => ({
      card: 'generic',
      title: '包拆拆 · 切镜',
      content: result.content,
    }),
    async execute(args, exec) {
      const cfg = configOf()
      const cwd = cwdOf(args)
      const video = path.resolve(String(args.video))
      const cutParams = resolveCutParams(args, { ...DEFAULT_CUT_PARAMS, ...cfg.cut })
      const wantFrames = args.frames !== false
      const maxShots = typeof args.maxShots === 'number' ? args.maxShots : cfg.maxShots
      const info = await getVideoInfo(video)

      let project = args.projectId
        ? await loadProject(String(args.projectId), cwd)
        : await findProjectByVideo(video, cwd)

      if (!project) {
        project = await createProject({
          videoPath: video,
          durationSec: info.durationSec,
          cutParams,
          cwd,
        })
      }

      const captured = await detectAndCaptureShots({
        videoPath: video,
        framesDir: wantFrames ? project.framesDir : undefined,
        cutParams,
        maxShots,
        signal: exec.signal,
        computeSceneSeries: true,
      })
      const durationSec = captured.durationSec ?? info.durationSec
      const shots = toBccShots(captured.detected, durationSec, captured.framePaths)
      project = await updateProjectShots(project.id, shots, { cutParams, durationSec }, cwd)

      return asJson({
        projectId: project.id,
        name: project.name,
        video: project.videoPath,
        durationSec: round2(project.durationSec),
        method: cutParams.method,
        cutParams,
        framesDir: wantFrames ? project.framesDir ?? null : null,
        shotCount: project.shots.length,
        shots: project.shots,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_set_cuts',
    description:
      'Replace shot boundaries with an explicit list of cut times in seconds (include 0). Use when the user says to add a cut at a timecode, merge shots, or delete a cut. Does not re-run detection.',
    parameters: {
      projectId: { type: 'string', required: true, description: 'Project id from bcc_shots' },
      cuts: { type: 'array', items: { type: 'number' }, required: true, description: 'Cut times in seconds, including 0' },
      recaptureFrames: { type: 'boolean', description: 'Re-extract keyframes for the new boundaries (default true)' },
      cwd: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const cwd = cwdOf(args)
      const project = await loadProject(String(args.projectId), cwd)
      const cuts = Array.isArray(args.cuts) ? args.cuts.map(Number) : []
      let shots = shotsFromCutTimes(cuts, project.durationSec, project.shots)
      if (args.recaptureFrames !== false && project.framesDir) {
        await fs.mkdir(project.framesDir, { recursive: true })
        for (let i = 0; i < shots.length; i++) {
          if (exec.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
          const grab = shots[i].thumbT ?? shots[i].startSec + Math.min(0.4, (shots[i].endSec - shots[i].startSec) / 2)
          try {
            shots[i] = { ...shots[i], frame: await extractFrame(project.videoPath, grab, project.framesDir) }
          } catch {
            /* keep previous frame */
          }
        }
      }
      const next = await updateProjectShots(project.id, shots, {}, cwd)
      return asJson({ projectId: next.id, shotCount: next.shots.length, shots: next.shots })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_read_frames',
    description:
      `Send keyframe images to the current model in small batches (max ${MAX_READ_FRAMES}). Requires a vision-capable model such as ${RECOMMENDED_MODEL}. Does not change the user model; if the model cannot see images, this tool fails with a switch hint.`,
    parameters: {
      projectId: { type: 'string', required: true },
      from: { type: 'number', description: '1-based start shot index (default 1)' },
      count: { type: 'number', description: `How many shots to include (default 4, max ${MAX_READ_FRAMES})` },
      indices: { type: 'array', items: { type: 'number' }, description: 'Explicit 1-based shot numbers; overrides from/count' },
      cwd: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const rec = value as {
          frames?: Array<{ index: number; startSec: number; endSec: number; attachment?: ImageAttachmentRef }>
          hint?: string
        }
        const blocks: ContentBlock[] = []
        if (rec.hint) blocks.push({ type: 'text', text: rec.hint })
        const frames = rec.frames ?? []
        const lines = frames.map((f) => `#${f.index} ${f.startSec.toFixed(2)}s–${f.endSec.toFixed(2)}s`)
        blocks.push({ type: 'text', text: `关键帧 ${lines.join(', ')}` })
        for (const f of frames) {
          if (f.attachment) blocks.push({ type: 'image', attachment: f.attachment })
        }
        return blocks
      },
    },
    async execute(args) {
      assertVisionOrHint(ctx)
      const attachments = ctx.attachments
      if (!attachments) {
        throw new Error(`当前运行时没有附件服务，无法把关键帧交给模型。${VISION_REQUIRED_MESSAGE}`)
      }
      const cwd = cwdOf(args)
      const project = await loadProject(String(args.projectId), cwd)
      if (project.shots.every((s) => !s.frame || !existsSync(s.frame))) {
        throw new Error('项目还没有关键帧。请先调用 bcc_shots 并设置 frames=true。')
      }
      let indices: number[]
      if (Array.isArray(args.indices) && args.indices.length) {
        indices = args.indices.map(Number)
      } else {
        const from = Math.max(1, typeof args.from === 'number' ? args.from : 1)
        const count = Math.min(MAX_READ_FRAMES, Math.max(1, typeof args.count === 'number' ? args.count : 4))
        indices = []
        for (let i = 0; i < count; i++) indices.push(from + i)
      }
      indices = [...new Set(indices)].filter((n) => n >= 1 && n <= project.shots.length).slice(0, MAX_READ_FRAMES)
      const selected = indices
        .map((index) => ({ index, shot: project.shots[index - 1] }))
        .filter((row) => row.shot.frame && existsSync(row.shot.frame))
      if (selected.length === 0) throw new Error('指定镜没有可用关键帧。')
      const refs = await attachments.saveImages(await Promise.all(selected.map(async (row) => ({
        data: new Uint8Array(await fs.readFile(row.shot.frame as string)),
        mediaType: 'image/jpeg' as const,
        name: `shot-${row.index}.jpg`,
      }))))
      return asJson({
        projectId: project.id,
        recommendedModel: RECOMMENDED_MODEL,
        hint: `若你看不见这些图片，说明当前模型无 image 模态。${VISION_REQUIRED_MESSAGE}`,
        frames: selected.map((row, i) => ({
          index: row.index,
          startSec: row.shot.startSec,
          endSec: row.shot.endSec,
          path: row.shot.frame ?? null,
          attachment: refs[i],
        })),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_export',
    description: 'Export a 包拆拆 script (md→docx/md/html) or storyboard (json→xlsx/html).',
    parameters: {
      kind: { type: 'string', enum: ['script', 'storyboard'], required: true },
      from: { type: 'string', required: true, description: 'Path to 剧本.md or 分镜.json' },
      out: { type: 'string', required: true, description: 'Output file or directory' },
      format: { type: 'string', description: 'Comma-separated: script docx,md,txt,html; storyboard xlsx,html' },
      video: { type: 'string' },
      name: { type: 'string' },
      projectId: { type: 'string' },
      cwd: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const cwd = cwdOf(args)
      const kind = String(args.kind)
      const from = path.resolve(String(args.from))
      if (!existsSync(from)) throw new Error(`找不到输入文件: ${from}`)
      const outRaw = path.resolve(String(args.out))
      const video = args.video ? path.resolve(String(args.video)) : undefined
      const formats = String(args.format ?? (kind === 'script' ? 'docx' : 'xlsx'))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const baseName = String(args.name ?? path.basename(from).replace(/\.[^.]+$/, ''))
      const written: string[] = []

      if (kind === 'script') {
        const text = (await fs.readFile(from, 'utf-8')).replace(/^\uFEFF/, '')
        const scenes = parseScript(text)
        let durationSec = 0
        if (video && existsSync(video)) durationSec = (await getVideoInfo(video)).durationSec
        else if (scenes.length) durationSec = Math.max(...scenes.map((s) => s.startSec))
        const result: ScriptResult = {
          jobId: 'dsh-bcc',
          videoPath: video ?? '',
          durationSec,
          script: text,
          scenes,
          generatedInMs: 0,
          generatedAt: Date.now(),
        }
        for (const format of formats) {
          const outPath = resolveOut(outRaw, baseName, format)
          await fs.mkdir(path.dirname(outPath), { recursive: true })
          if (format === 'docx') await fs.writeFile(outPath, await generateScriptDocx(result))
          else if (format === 'md' || format === 'txt') await fs.writeFile(outPath, text, 'utf-8')
          else if (format === 'html') {
            const html = await buildProjectHtml({ projectName: baseName, videoPath: video, scenes, shots: [], framePaths: [] })
            await fs.writeFile(outPath, html, 'utf-8')
          } else throw new Error(`不支持的剧本格式: ${format}`)
          written.push(outPath)
        }
        if (args.projectId) {
          const p = await loadProject(String(args.projectId), cwd)
          await saveProject({ ...p, scriptPath: written[0] }, cwd)
        }
      } else {
        const raw = JSON.parse((await fs.readFile(from, 'utf-8')).replace(/^\uFEFF/, '')) as
          | Array<Record<string, unknown>>
          | { shots?: Array<Record<string, unknown>>; durationSec?: number; framePaths?: string[] }
        const inputs = Array.isArray(raw) ? raw : raw.shots ?? []
        if (!inputs.length) throw new Error('分镜 JSON 为空')
        let durationSec = !Array.isArray(raw) && raw.durationSec ? raw.durationSec : 0
        if (!durationSec && video && existsSync(video)) durationSec = (await getVideoInfo(video)).durationSec
        const shots: StoryboardShot[] = inputs.map((s, i) => {
          const startSec = Number(s.startSec ?? 0)
          return {
            number: Number(s.number ?? i + 1),
            shotType: String(s.shotType ?? ''),
            angle: String(s.angle ?? ''),
            cameraMove: String(s.cameraMove ?? ''),
            description: String(s.description ?? ''),
            dialogue: String(s.dialogue ?? ''),
            sound: String(s.sound ?? ''),
            timeRange: String(s.timeRange ?? ''),
            startSec,
            endSec: Number(s.endSec ?? (i < inputs.length - 1 ? Number(inputs[i + 1].startSec ?? durationSec) : durationSec)),
            sceneScore: 0,
          }
        })
        let framePaths = !Array.isArray(raw) && raw.framePaths ? raw.framePaths : inputs.map((s) => String(s.frame ?? ''))
        if (video && framePaths.some((p) => !p || !existsSync(p))) {
          const tmp = path.join(cwd, '.dsh-bcc', 'tmp-frames')
          await fs.mkdir(tmp, { recursive: true })
          for (let i = 0; i < shots.length; i++) {
            if (framePaths[i] && existsSync(framePaths[i])) continue
            const mid = shots[i].startSec + Math.min(0.5, Math.max(0.1, (shots[i].endSec - shots[i].startSec) / 2))
            try { framePaths[i] = await extractFrame(video, mid, tmp) } catch { framePaths[i] = '' }
          }
        }
        for (const format of formats) {
          const outPath = resolveOut(outRaw, baseName, format)
          await fs.mkdir(path.dirname(outPath), { recursive: true })
          if (format === 'xlsx') await generateStoryboardXlsx(shots, framePaths, outPath, durationSec)
          else if (format === 'html') {
            const html = await buildProjectHtml({ projectName: baseName, videoPath: video, scenes: [], shots, framePaths })
            await fs.writeFile(outPath, html, 'utf-8')
          } else throw new Error(`不支持的分镜格式: ${format}`)
          written.push(outPath)
        }
        if (args.projectId) {
          const p = await loadProject(String(args.projectId), cwd)
          await saveProject({ ...p, storyboardPath: written[0] }, cwd)
        }
      }
      return asJson({ files: written })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_master',
    description: 'Return 山之音 (or other) methodology text to use as an analysis framework. Ignore interactive-flow rules in the text.',
    parameters: {
      id: { type: 'string', description: 'Master id or name; omit with list=true' },
      list: { type: 'boolean', description: 'List available masters' },
      kind: { type: 'string', enum: ['script', 'storyboard'], description: 'Which appendix (default script)' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const rec = value as { text?: unknown }
        return [{ type: 'text', text: typeof rec.text === 'string' ? rec.text : JSON.stringify(value) }]
      },
    },
    async execute(args) {
      if (args.list) {
        return asJson({ masters: listMasters().map((m) => ({ id: m.id, name: m.name, description: m.description })) })
      }
      const raw = String(args.id ?? 'shanzhiyin')
      const id = resolveMasterId(raw)
      if (!id) throw new Error(`未知大师: ${raw}`)
      const kind = args.kind === 'storyboard' ? 'storyboard' : 'script'
      const text = kind === 'script' ? getScriptMasterAddendum(id) : getStoryboardMasterAddendum(id)
      return asJson({ id, kind, text: text.trim() })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_project_list',
    description: 'List 包拆拆 projects in the workspace .dsh-bcc/projects directory.',
    parameters: { cwd: { type: 'string' } },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const projects = await listProjects(cwdOf(args))
      return asJson({
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          videoPath: p.videoPath,
          shotCount: p.shots.length,
          updatedAt: p.updatedAt,
          hasScript: !!p.scriptPath,
          hasStoryboard: !!p.storyboardPath,
        })),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_project_open',
    description: 'Load one 包拆拆 project including shot list.',
    parameters: {
      projectId: { type: 'string', required: true },
      cwd: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      return asJson(await loadProject(String(args.projectId), cwdOf(args)))
    },
  }))
}

function resolveOut(out: string, baseName: string, format: string): string {
  const ext = `.${format}`
  if (out.endsWith(ext) || /\.[a-z0-9]+$/i.test(path.basename(out))) return out
  return path.join(out, `${baseName}${ext}`)
}
