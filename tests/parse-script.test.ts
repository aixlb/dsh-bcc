import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseScript } from '../src/lib/parse-script.js'
import { shotsFromCutTimes } from '../src/lib/cuts.js'

test('parseScript reads timestamped scenes', () => {
  const scenes = parseScript(`[00:00] 1-1 办公室 日/内
△ 主角看电脑
张三：方案被退了。

[00:15] 1-2 会议室
△ 投影亮起
`)
  assert.equal(scenes.length, 2)
  assert.equal(scenes[0].startSec, 0)
  assert.equal(scenes[1].startSec, 15)
  assert.match(scenes[0].body, /张三/)
})

test('shotsFromCutTimes always starts at 0 and fills end', () => {
  const shots = shotsFromCutTimes([3, 0, 3, 10], 20)
  assert.deepEqual(shots.map((s) => [s.index, s.startSec, s.endSec]), [
    [1, 0, 3],
    [2, 3, 10],
    [3, 10, 20],
  ])
})

test('planScriptSampleTimes puts several frames inside a long shot', async () => {
  const { planScriptSampleTimes } = await import('../src/lib/script-frames.js')
  const samples = planScriptSampleTimes({
    durationSec: 30,
    shots: [{ index: 1, startSec: 0, endSec: 20 }],
    intervalSec: 2,
    maxPerShot: 8,
  })
  assert.ok(samples.length >= 4, `expected dense samples, got ${samples.length}`)
  assert.ok(samples[0].t < 2)
  assert.ok(samples[samples.length - 1].t > 16)
})

test('analyzeScriptCoverage flags gaps and thin scripts', async () => {
  const { analyzeScriptCoverage } = await import('../src/lib/script-coverage.js')
  const report = analyzeScriptCoverage(`[00:00] 1-1 开场\n△ 一闪\n\n[00:40] 1-2 结尾\n△ 结束\n`, 60)
  assert.equal(report.complete, false)
  assert.ok(report.gaps.length >= 1)
  assert.equal(report.volumeOk, false)
})

test('planScriptSampleTimes keeps a single frame on short shots', async () => {
  const { planScriptSampleTimes } = await import('../src/lib/script-frames.js')
  const samples = planScriptSampleTimes({
    durationSec: 4,
    shots: [
      { index: 1, startSec: 0, endSec: 0.8 },
      { index: 2, startSec: 0.8, endSec: 4 },
    ],
    intervalSec: 1.5,
    maxPerShot: 8,
  })
  assert.equal(samples.filter((s) => s.shotIndex === 1).length, 1)
  assert.ok(samples.filter((s) => s.shotIndex === 2).length >= 2)
})

test('analyzeScriptCoverage passes a dense timestamped script', async () => {
  const { analyzeScriptCoverage } = await import('../src/lib/script-coverage.js')
  const script = `[00:00] 1-1 办公室 日/内
△ 主角走进办公室，电脑亮着，桌上有一杯咖啡。他坐下打开邮件。
【字幕】方案被退回
张三：这个方案怎么又被退了？

[00:04] 1-2 窗边
△ 他站起来走到窗边，外面下雨。电话响了，他接起来却没说话。
【画面未见对白】

[00:08] 1-3 结尾
△ 他挂掉电话，关掉电脑，走出房间。灯灭。走廊里只剩雨声。
`
  const report = analyzeScriptCoverage(script, 10)
  assert.equal(report.missingHead, false)
  assert.equal(report.missingTail, false)
  assert.equal(report.gaps.length, 0)
  assert.equal(report.volumeOk, true)
  assert.equal(report.complete, true)
})

test('slash command names are lowercase ascii', async () => {
  const { SCRIPT_COMMAND, STORYBOARD_COMMAND } = await import('../src/command-names.js')
  const ok = /^[a-z0-9_-]+$/
  assert.match(SCRIPT_COMMAND, ok)
  assert.match(STORYBOARD_COMMAND, ok)
})

test('script and storyboard prompts tell the agent the full pipeline', async () => {
  const { scriptPrompt, storyboardPrompt, DEFAULT_STORYBOARD_CONFIG } = await import('../src/client/prefs.js')
  const script = scriptPrompt('E:/clip.mp4')
  assert.match(script, /bcc-script/)
  assert.match(script, /bcc_sample_script/)
  assert.match(script, /remaining=0/)
  const board = storyboardPrompt('E:/clip.mp4', DEFAULT_STORYBOARD_CONFIG)
  assert.match(board, /bcc-storyboard/)
  assert.match(board, /source=shots/)
  assert.match(board, /smart/)
})
