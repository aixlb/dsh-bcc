import { parseScript } from './parse-script.js'

export interface ScriptGap {
  fromSec: number
  toSec: number
}

export interface ScriptCoverage {
  durationSec: number
  sceneCount: number
  firstSec: number | null
  lastSec: number | null
  charCount: number
  expectedMinChars: number
  gaps: ScriptGap[]
  missingHead: boolean
  missingTail: boolean
  volumeOk: boolean
  complete: boolean
  notes: string[]
}

/** Flag a hole when the next scene starts more than this many seconds later. */
const GAP_SEC = 8
/** Tail is missing if last scene starts this far before the end. */
const TAIL_SEC = 6

export function analyzeScriptCoverage(script: string, durationSec: number): ScriptCoverage {
  const scenes = parseScript(script)
  const duration = Math.max(0, durationSec)
  const minutes = duration / 60
  const expectedMinChars = Math.round(minutes * 300)
  const charCount = script.replace(/\s+/g, '').length
  const firstSec = scenes.length ? scenes[0].startSec : null
  const lastSec = scenes.length ? scenes[scenes.length - 1].startSec : null
  const gaps: ScriptGap[] = []
  for (let i = 0; i < scenes.length - 1; i++) {
    const from = scenes[i].startSec
    const to = scenes[i + 1].startSec
    if (to - from > GAP_SEC) gaps.push({ fromSec: from, toSec: to })
  }
  const missingHead = firstSec == null || firstSec > 2
  const missingTail = lastSec == null || (duration > 0 && duration - lastSec > TAIL_SEC)
  const volumeOk = charCount >= expectedMinChars
  const notes: string[] = []
  if (scenes.length === 0) notes.push('剧本里没有解析到任何带时间戳的场景。')
  if (missingHead) notes.push('开头未覆盖到 00:00。')
  if (missingTail) notes.push(`结尾未覆盖到片尾（最后场景 ${lastSec?.toFixed(1) ?? '-'}s，片长 ${duration.toFixed(1)}s）。`)
  for (const g of gaps) {
    notes.push(`时间轴缺口 ${g.fromSec.toFixed(1)}s → ${g.toSec.toFixed(1)}s（>${GAP_SEC}s），必须补看该段采样帧。`)
  }
  if (!volumeOk) {
    notes.push(`体量不足：约 ${charCount} 字，按时长至少应有 ${expectedMinChars} 字（1 分钟 ≈ 300 字）。回头补看补写，不得交稿。`)
  }
  const complete = scenes.length > 0 && !missingHead && !missingTail && gaps.length === 0 && volumeOk
  return {
    durationSec: duration,
    sceneCount: scenes.length,
    firstSec,
    lastSec,
    charCount,
    expectedMinChars,
    gaps,
    missingHead,
    missingTail,
    volumeOk,
    complete,
    notes,
  }
}
