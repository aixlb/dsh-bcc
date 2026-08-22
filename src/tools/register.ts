import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { getVideoInfo, formatHMS } from '../lib/video.js'
import { detectAndCaptureShots, round2, shotsFromCutTimes, toBccShots } from '../lib/shots.js'
import { extractFrame } from '../lib/storyboard.js'
import { captureScriptSamples } from '../lib/script-frames.js'
import { analyzeScriptCoverage } from '../lib/script-coverage.js'
import type { ScriptSample } from '../lib/types.js'
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
  const rawMethod = String(args.cutMethod ?? args.cut_method ?? fallback.method)
  const method: CutParams['method'] = rawMethod === 'scene' || rawMethod === 'smart' || rawMethod === 'interval'
    ? rawMethod
    : fallback.method
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
    interval_sec: num(['intervalSec', 'interval_sec'], fallback.interval_sec ?? 1),
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
      'Detect shot cuts and optionally extract one keyframe per cut. cutMethod=interval (拆剧本默认) slices the timeline every intervalSec seconds. smart/scene are for 拆分镜. For interval, next read source=shots until remaining=0, then merge beats — do not call bcc_sample_script.',
    parameters: {
      video: { type: 'string', required: true, description: 'Absolute path to the video' },
      projectId: { type: 'string', description: 'Existing project id to update' },
      frames: { type: 'boolean', description: 'Extract keyframes (default true)' },
      cutMethod: { type: 'string', enum: ['smart', 'scene', 'interval'], description: 'interval = every N seconds (script); smart/scene = storyboard' },
      intervalSec: { type: 'number', description: 'interval: seconds between cuts (default 1)' },
      hardMin: { type: 'number', description: 'smart: minimum hard-cut frame diff (default 5.5; lower = more sensitive)' },
      hardRatio: { type: 'number', description: 'smart: ratio vs local median (default 8)' },
      minGap: { type: 'number', description: 'smart: minimum gap between cuts in seconds (default 0.3)' },
      threshold: { type: 'number', description: 'scene: score threshold 0-1 (default 0.3)' },
      maxShots: { type: 'number', description: 'Max shots (interval default 1200, otherwise 200)' },
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
      const maxShots = typeof args.maxShots === 'number'
        ? args.maxShots
        : (cutParams.method === 'interval' ? 1200 : cfg.maxShots)
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
    name: 'bcc_sample_script',
    description:
      'Dense still sampling for 拆剧本. Pulls several frames inside each shot (not just the cut) so plot inside long shots is not dropped. Call this AFTER bcc_shots, BEFORE reading frames for a script. Then walk bcc_read_frames source=script until remaining=0.',
    parameters: {
      projectId: { type: 'string', required: true },
      intervalSec: { type: 'number', description: 'Target seconds between samples inside a shot (default 1.5)' },
      maxPerShot: { type: 'number', description: 'Cap frames per shot (default 8)' },
      maxTotal: { type: 'number', description: 'Cap total samples (default 200)' },
      cwd: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const cwd = cwdOf(args)
      const project = await loadProject(String(args.projectId), cwd)
      if (!project.shots.length) throw new Error('项目还没有镜头。请先 bcc_shots（frames=true）。')
      const outputDir = path.join(path.resolve(cwd, '.dsh-bcc', 'projects', project.id), 'script-frames')
      const samples = await captureScriptSamples({
        videoPath: project.videoPath,
        durationSec: project.durationSec,
        shots: project.shots,
        outputDir,
        intervalSec: typeof args.intervalSec === 'number' ? args.intervalSec : undefined,
        maxPerShot: typeof args.maxPerShot === 'number' ? args.maxPerShot : undefined,
        maxTotal: typeof args.maxTotal === 'number' ? args.maxTotal : undefined,
        signal: exec.signal,
      })
      const next = await saveProject({ ...project, scriptSamples: samples }, cwd)
      const batches = Math.ceil(samples.length / 6)
      return asJson({
        projectId: next.id,
        sampleCount: samples.length,
        durationSec: round2(project.durationSec),
        intervalHint: '1.5s inside each shot, extra start/end frames on long shots',
        next: {
          tool: 'bcc_read_frames',
          source: 'script',
          from: 1,
          count: 6,
          batches,
          instruction: `共 ${samples.length} 张剧本采样帧，约 ${batches} 批。必须从 from=1 起连续读完 remaining=0，每批把该时间段写入剧本后再读下一批。禁止只看前几批就交稿。`,
        },
        samples: samples.map((s) => ({ index: s.index, t: s.t, shotIndex: s.shotIndex })),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_read_frames',
    description:
      `Send video stills to the current vision model in small batches (max ${MAX_READ_FRAMES}). For 拆剧本 use source=script AFTER bcc_sample_script, and KEEP CALLING with the returned nextFrom until remaining=0. Default source=shots is one frame per cut (storyboard only). Never skip the rest of the timeline.`,
    parameters: {
      projectId: { type: 'string', required: true },
      source: { type: 'string', enum: ['shots', 'script'], description: 'shots = one keyframe per cut (分镜). script = dense 拆剧本 samples from bcc_sample_script.' },
      from: { type: 'number', description: '1-based start index (default 1)' },
      count: { type: 'number', description: `How many stills this batch (default 6, max ${MAX_READ_FRAMES})` },
      indices: { type: 'array', items: { type: 'number' }, description: 'Explicit 1-based indexes; overrides from/count' },
      cwd: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const rec = value as {
          frames?: Array<{
            index: number
            t?: number
            startSec?: number
            endSec?: number
            label?: string
            attachment?: ImageAttachmentRef
          }>
          hint?: string
          coverage?: { remaining?: number; nextFrom?: number; instruction?: string }
        }
        const blocks: ContentBlock[] = []
        if (rec.hint) blocks.push({ type: 'text', text: rec.hint })
        if (rec.coverage?.instruction) blocks.push({ type: 'text', text: rec.coverage.instruction })
        for (const f of rec.frames ?? []) {
          const caption = f.label
            ?? (f.t != null ? `[${formatHMS(f.t)}]` : `#${f.index} ${f.startSec?.toFixed(2)}s–${f.endSec?.toFixed(2)}s`)
          blocks.push({ type: 'text', text: caption })
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
      const source = args.source === 'script' || (!args.source && (project.scriptSamples?.length ?? 0) > 0)
        ? 'script'
        : 'shots'

      type Item = { index: number; t: number; startSec: number; endSec: number; path: string; shotIndex?: number }
      let items: Item[] = []
      if (source === 'script') {
        const samples = project.scriptSamples ?? []
        if (!samples.length) {
          throw new Error('还没有剧本采样帧。拆剧本请先调用 bcc_sample_script，不要只用每镜一张切点图。')
        }
        items = samples.map((s: ScriptSample) => {
          const shot = project.shots.find((x) => x.index === s.shotIndex)
          return {
            index: s.index,
            t: s.t,
            startSec: shot?.startSec ?? s.t,
            endSec: shot?.endSec ?? s.t,
            path: s.path,
            shotIndex: s.shotIndex,
          }
        })
      } else {
        if (project.shots.every((s) => !s.frame || !existsSync(s.frame))) {
          throw new Error('项目还没有关键帧。请先调用 bcc_shots 并设置 frames=true。')
        }
        items = project.shots.map((shot) => ({
          index: shot.index,
          t: shot.thumbT ?? shot.startSec,
          startSec: shot.startSec,
          endSec: shot.endSec,
          path: shot.frame ?? '',
          shotIndex: shot.index,
        }))
      }

      let indices: number[]
      if (Array.isArray(args.indices) && args.indices.length) {
        indices = args.indices.map(Number)
      } else {
        const from = Math.max(1, typeof args.from === 'number' ? args.from : 1)
        const count = Math.min(MAX_READ_FRAMES, Math.max(1, typeof args.count === 'number' ? args.count : 6))
        indices = []
        for (let i = 0; i < count; i++) indices.push(from + i)
      }
      indices = [...new Set(indices)].filter((n) => n >= 1 && n <= items.length).slice(0, MAX_READ_FRAMES)
      const selected = indices.map((index) => items[index - 1]).filter((row) => row.path && existsSync(row.path))
      if (selected.length === 0) throw new Error('指定范围没有可用帧。')
      const payloads = await Promise.all(selected.map(async (row) => ({
        data: new Uint8Array(await fs.readFile(row.path)),
        mediaType: 'image/jpeg' as const,
        name: `${source}-${row.index}.jpg`,
      })))
      const saveImages = (attachments as { saveImages?: (inputs: typeof payloads) => Promise<readonly ImageAttachmentRef[]> }).saveImages
      const refs = typeof saveImages === 'function'
        ? await saveImages(payloads)
        : await Promise.all(payloads.map((item) => attachments.saveImage(item)))
      const lastIndex = selected[selected.length - 1].index
      const remaining = Math.max(0, items.length - lastIndex)
      const nextFrom = remaining > 0 ? lastIndex + 1 : null
      const instruction = remaining > 0
        ? `本批 ${selected.length} 张（${selected[0].index}–${lastIndex} / 共 ${items.length}）。还剩 ${remaining} 张未看。看完本批后立刻把这段时间写入剧本，然后立刻再调 bcc_read_frames source=${source} from=${nextFrom} count=6。remaining=0 之前禁止交稿。`
        : `已看完全部 ${items.length} 张。接下来用 bcc_script_coverage 自查时间轴缺口和体量，缺口段再补看。`

      return asJson({
        projectId: project.id,
        source,
        recommendedModel: RECOMMENDED_MODEL,
        hint: `每张图上方文字是时间戳。若看不见图：${VISION_REQUIRED_MESSAGE}`,
        coverage: {
          total: items.length,
          from: selected[0].index,
          to: lastIndex,
          returned: selected.length,
          remaining,
          nextFrom,
          done: remaining === 0,
          instruction,
        },
        frames: selected.map((row, i) => ({
          index: row.index,
          t: row.t,
          startSec: row.startSec,
          endSec: row.endSec,
          shotIndex: row.shotIndex ?? null,
          path: row.path,
          label: `[${formatHMS(row.t)}] 镜${row.shotIndex ?? row.index} · ${row.index}/${items.length}`,
          attachment: refs[i],
        })),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bcc_script_coverage',
    description:
      'Check a 剧本.md against video duration: timeline gaps, missing head/tail, and character volume (≈300 chars/min). If complete=false, re-read the gap ranges with bcc_read_frames and patch the script. Do not export until complete=true.',
    parameters: {
      from: { type: 'string', required: true, description: 'Path to 剧本.md' },
      projectId: { type: 'string', description: 'Used to read duration if durationSec omitted' },
      durationSec: { type: 'number' },
      cwd: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const cwd = cwdOf(args)
      const from = path.resolve(String(args.from))
      if (!existsSync(from)) throw new Error(`找不到剧本: ${from}`)
      const text = (await fs.readFile(from, 'utf-8')).replace(/^\uFEFF/, '')
      let durationSec = typeof args.durationSec === 'number' ? args.durationSec : 0
      if ((!durationSec || durationSec <= 0) && args.projectId) {
        durationSec = (await loadProject(String(args.projectId), cwd)).durationSec
      }
      const coverage = analyzeScriptCoverage(text, durationSec)
      return asJson({
        ...coverage,
        instruction: coverage.complete
          ? '覆盖自查通过，可以 bcc_export。'
          : '未通过。对每个 gaps[] 时间段，用 bcc_read_frames source=script 找到落在该区间的采样帧补看，把缺失场景写进剧本后再跑一次本工具。',
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
