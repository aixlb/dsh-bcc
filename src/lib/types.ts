/** 分镜切割方式。interval = 拆剧本按秒切片。 */
export type CutMethod = 'smart' | 'scene' | 'interval'

export interface CutParams {
  method: CutMethod
  scene_threshold: number
  smart_hard_min: number
  smart_hard_ratio: number
  smart_min_gap: number
  interval_sec: number
}

export const DEFAULT_CUT_PARAMS: CutParams = {
  method: 'smart',
  scene_threshold: 0.3,
  smart_hard_min: 5.5,
  smart_hard_ratio: 8,
  smart_min_gap: 0.3,
  interval_sec: 1,
}

export interface StoryboardShot {
  number: number
  shotType: string
  angle: string
  cameraMove: string
  description: string
  dialogue: string
  sound: string
  timeRange: string
  startSec: number
  endSec: number
  sceneScore: number
  userEdited?: boolean
}

export interface ScriptScene {
  charStart: number
  charEnd: number
  startSec: number
  heading: string
  body: string
  number: string
}

export interface ScriptResult {
  jobId: string
  videoPath: string
  durationSec: number
  script: string
  scenes: ScriptScene[]
  generatedInMs: number
  generatedAt: number
  scriptPath?: string
}

export interface SceneScorePoint {
  t: number
  score: number
}

export interface SceneScoreData {
  threshold: number
  durationSec: number
  points: SceneScorePoint[]
}

export interface StoryboardCapturedFrame {
  index: number
  path: string
  timestamp: number
  score: number
  kind?: string
}

export interface DetectedShot {
  timestamp: number
  score: number
  thumbT?: number
  kind?: string
}

export interface BccShot {
  index: number
  startSec: number
  endSec: number
  thumbT?: number
  score: number
  kind?: string
  frame?: string
}

/** Dense stills for 拆剧本 — several frames inside each shot, not just the cut. */
export interface ScriptSample {
  /** 1-based index in the sample list */
  index: number
  /** Seconds into the video */
  t: number
  /** 1-based shot this sample belongs to */
  shotIndex: number
  path: string
}

export interface BccProject {
  id: string
  name: string
  videoPath: string
  createdAt: number
  updatedAt: number
  durationSec: number
  cutParams: CutParams
  shots: BccShot[]
  framesDir?: string
  scriptSamples?: ScriptSample[]
  scriptPath?: string
  storyboardPath?: string
  styleGuidePath?: string
  shotStyle?: 'full7' | 'simple'
  scriptMaster?: string
  storyboardMaster?: string
  extractPrompt?: string
  mergePrompt?: string
}

export interface VisionUnsupportedErrorPayload {
  code: 'VISION_UNSUPPORTED'
  message: string
  recommendedModel: string
}
