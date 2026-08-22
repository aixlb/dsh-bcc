import {
  DEFAULT_SCRIPT_EXTRACT_PROMPT,
  DEFAULT_SCRIPT_MERGE_PROMPT,
  resolveScriptPrompt,
} from '../lib/script-prompts.js'

export type BccMode = 'script' | 'storyboard'
export type ShotStyle = 'full7' | 'simple'
export type CutMethod = 'smart' | 'scene' | 'interval'
export type MasterId = '' | 'shanzhiyin'

export interface StoryboardUiConfig {
  skill: 'bcc-storyboard'
  master: MasterId
  shotStyle: ShotStyle
  cutMethod: Exclude<CutMethod, 'interval'>
  hardMin: number
  hardRatio: number
  minGap: number
  threshold: number
  maxShots: number
}

export interface ScriptUiConfig {
  intervalSec: number
  maxShots: number
  extractPrompt: string
  mergePrompt: string
}

export interface BccUiState {
  mode: BccMode
  videoPath: string
  projectId: string
  scriptMaster: MasterId
  script: ScriptUiConfig
  storyboard: StoryboardUiConfig
}

export interface CutParamsView {
  method: CutMethod
  scene_threshold: number
  smart_hard_min: number
  smart_hard_ratio: number
  smart_min_gap: number
  interval_sec: number
}

const KEY = 'dsh-bcc.storyboard-config'
const UI_KEY = 'dsh-bcc.ui'

export const DEFAULT_STORYBOARD_CONFIG: StoryboardUiConfig = {
  skill: 'bcc-storyboard',
  master: '',
  shotStyle: 'full7',
  cutMethod: 'smart',
  hardMin: 5.5,
  hardRatio: 8,
  minGap: 0.3,
  threshold: 0.3,
  maxShots: 200,
}

export const DEFAULT_SCRIPT_CONFIG: ScriptUiConfig = {
  intervalSec: 1,
  maxShots: 1200,
  extractPrompt: DEFAULT_SCRIPT_EXTRACT_PROMPT,
  mergePrompt: DEFAULT_SCRIPT_MERGE_PROMPT,
}

export const DEFAULT_UI: BccUiState = {
  mode: 'storyboard',
  videoPath: '',
  projectId: '',
  scriptMaster: '',
  script: { ...DEFAULT_SCRIPT_CONFIG },
  storyboard: { ...DEFAULT_STORYBOARD_CONFIG },
}

export function loadStoryboardConfig(): StoryboardUiConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_STORYBOARD_CONFIG }
    const parsed = JSON.parse(raw) as Partial<StoryboardUiConfig>
    return { ...DEFAULT_STORYBOARD_CONFIG, ...parsed, skill: 'bcc-storyboard' }
  } catch {
    return { ...DEFAULT_STORYBOARD_CONFIG }
  }
}

export function saveStoryboardConfig(config: StoryboardUiConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config))
}

export function loadUiState(): BccUiState {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BccUiState>
      return {
        ...DEFAULT_UI,
        ...parsed,
        script: { ...DEFAULT_SCRIPT_CONFIG, ...parsed.script },
        storyboard: { ...DEFAULT_STORYBOARD_CONFIG, ...parsed.storyboard, skill: 'bcc-storyboard' },
      }
    }
    return { ...DEFAULT_UI, storyboard: loadStoryboardConfig() }
  } catch {
    return { ...DEFAULT_UI }
  }
}

export function saveUiState(state: BccUiState): void {
  localStorage.setItem(UI_KEY, JSON.stringify(state))
  saveStoryboardConfig(state.storyboard)
}

export function cutParamsFromUi(sb: StoryboardUiConfig): CutParamsView {
  return {
    method: sb.cutMethod,
    scene_threshold: sb.threshold,
    smart_hard_min: sb.hardMin,
    smart_hard_ratio: sb.hardRatio,
    smart_min_gap: sb.minGap,
    interval_sec: 1,
  }
}

export function applyCutParams(sb: StoryboardUiConfig, cut: Partial<CutParamsView>): StoryboardUiConfig {
  return {
    ...sb,
    cutMethod: cut.method === 'scene' || cut.method === 'smart' ? cut.method : sb.cutMethod,
    threshold: num(cut.scene_threshold, sb.threshold),
    hardMin: num(cut.smart_hard_min, sb.hardMin),
    hardRatio: num(cut.smart_hard_ratio, sb.hardRatio),
    minGap: num(cut.smart_min_gap, sb.minGap),
  }
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function scriptPrompt(videoPath: string, cfg: ScriptUiConfig = DEFAULT_SCRIPT_CONFIG, master: MasterId = ''): string {
  const interval = cfg.intervalSec > 0 ? cfg.intervalSec : 1
  const extract = resolveScriptPrompt(cfg.extractPrompt, DEFAULT_SCRIPT_EXTRACT_PROMPT)
  const merge = resolveScriptPrompt(cfg.mergePrompt, DEFAULT_SCRIPT_MERGE_PROMPT)
  const lines = [
    '请用 bcc-script skill 拆剧本。',
    `视频文件：${videoPath}`,
    `切割方式 interval，每 ${interval} 秒一刀，maxShots=${cfg.maxShots}。`,
    `调用 bcc_shots video=该路径 cutMethod=interval intervalSec=${interval} maxShots=${cfg.maxShots} frames=true。`,
    '不要调用 bcc_sample_script：间隔切已经是均匀采样。',
    '然后 bcc_read_frames source=shots 从 from=1 循环到 remaining=0。每批严格按下面「提取提示词」把该段写成节拍，追加进 节拍.md（不要删前面已写的）。',
    '全部看完后，把 节拍.md 按下面「合并提示词」合并成 剧本.md（重复内容合并、时间轴不断）。',
    'bcc_script_coverage 自查通过后再 bcc_export kind=script。',
    '看不见字幕的对白写【画面未见对白】。不要只看前几批就交稿。',
    '',
    '## 提取提示词（用户指定，必须遵守；源文件 prompts/script-extract.md）',
    extract,
    '',
    '## 合并提示词（用户指定，必须遵守；源文件 prompts/script-merge.md）',
    merge,
  ]
  if (master === 'shanzhiyin') {
    lines.splice(2, 0, '先 bcc_master id=shanzhiyin kind=script 作为分析框架（忽略其中的问答流程）。')
  }
  return lines.join('\n')
}

export function storyboardPrompt(videoPath: string, cfg: StoryboardUiConfig): string {
  const style = cfg.shotStyle === 'simple'
    ? '分镜类型：简版（景别、角度、运镜、一段画面描述、台词、音效即可，不必七行）'
    : '分镜类型：标准七段（风格限定 / 景别 / 视角构图 / 主体描述 / 背景设定 / 细节修饰 / 光影色调）'
  const master = cfg.master === 'shanzhiyin'
    ? '先 bcc_master id=shanzhiyin kind=storyboard 作为分析框架（忽略其中的问答流程）。'
    : '不注入大师方法论。'
  const cut = cfg.cutMethod === 'scene'
    ? `切割方式 scene，threshold=${cfg.threshold}，maxShots=${cfg.maxShots}`
    : `切割方式 smart，hardMin=${cfg.hardMin}，hardRatio=${cfg.hardRatio}，minGap=${cfg.minGap}，maxShots=${cfg.maxShots}`
  return [
    '请用 bcc-storyboard skill 拆分镜。',
    `视频文件：${videoPath}`,
    `技能：${cfg.skill}`,
    style,
    cut,
    master,
    '先 bcc_shots 按上面的切割参数抽关键帧，再 bcc_read_frames source=shots 逐批看完全部镜头后写 分镜.json，最后 bcc_export kind=storyboard。',
    '用户之后用聊天改切镜（切太碎/太粗/某秒再切）时用 bcc_set_cuts 或重跑 bcc_shots。',
  ].join('\n')
}

export function startPrompt(state: BccUiState): string {
  const video = state.videoPath.trim()
  if (!video) throw new Error('请先选择或填写视频地址')
  return state.mode === 'script'
    ? scriptPrompt(video, state.script ?? DEFAULT_SCRIPT_CONFIG, state.scriptMaster)
    : storyboardPrompt(video, state.storyboard)
}
