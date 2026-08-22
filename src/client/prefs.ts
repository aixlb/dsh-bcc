export type BccMode = 'script' | 'storyboard'
export type ShotStyle = 'full7' | 'simple'
export type CutMethod = 'smart' | 'scene'
export type MasterId = '' | 'shanzhiyin'

export interface StoryboardUiConfig {
  skill: 'bcc-storyboard'
  master: MasterId
  shotStyle: ShotStyle
  cutMethod: CutMethod
  hardMin: number
  hardRatio: number
  minGap: number
  threshold: number
  maxShots: number
}

const KEY = 'dsh-bcc.storyboard-config'

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

export function scriptPrompt(videoPath: string): string {
  return [
    '请用 bcc-script skill 拆剧本。',
    `视频文件：${videoPath}`,
    '必须按新流程：bcc_shots（frames=true）→ bcc_sample_script → bcc_read_frames source=script 从 from=1 循环到 remaining=0（每批先写入剧本再读下一批）→ bcc_script_coverage 自查通过后再 bcc_export。',
    '不要只看前几张切点图。看不见字幕的对白写【画面未见对白】。',
  ].join('\n')
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
