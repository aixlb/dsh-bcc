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
