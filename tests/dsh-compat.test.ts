import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { ISessions, SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { SlotCore, type SlotMap } from '@deepseek-ai/dsh-client-ui-slots'
import { registerTools } from '../src/tools/register.js'
import { registerDock } from '../src/client/dock.js'
import { registerCommandViews } from '../src/client/commandview.js'
import { createPromptSender } from '../src/client/composer.js'
import { setDockOpen } from '../src/client/dock-store.js'
import { workspaceOf } from '../src/lib/workspace.js'
import { assertVisionOrHint, modelSupportsVision } from '../src/lib/vision.js'
import { DEFAULT_CUT_PARAMS } from '../src/lib/types.js'
import { createProject } from '../src/store/projects.js'

function fakeAgent(cwd: string, model = 'custom-image-model'): Agent {
  return {
    options: { provider: 'default-provider', model: 'default-text-model' },
    session: { header: { cwd }, requestHeader: () => ({ config: { provider: 'session-provider', model } }) },
  } as unknown as Agent
}

test('workspace follows the calling session and current directory without changing process cwd', () => {
  const original = path.resolve('original-project')
  const current = path.resolve('current-project')
  const ctx = { get: () => ({ get: () => current }) } as unknown as Context
  const agent = fakeAgent(original)
  assert.equal(workspaceOf(ctx, {}, { agent }), current)
  assert.equal(workspaceOf(ctx, { cwd: 'child' }, { agent }), path.join(current, 'child'))
  const oldHost = { get: () => undefined } as unknown as Context
  assert.equal(workspaceOf(oldHost, {}, { agent }), original)
  assert.equal(workspaceOf(oldHost, {}, {}), process.cwd())
})

test('vision checks the actual request route and provider modalities, including unknown and cancellation', async () => {
  const agent = fakeAgent(process.cwd())
  let modalities: string[] | undefined = ['text', 'image']
  const ctx = { get: () => ({
    async resolveModelInfo(provider: string, model: string) {
      assert.equal(provider, 'session-provider')
      assert.equal(model, 'custom-image-model')
      return { inputModalities: modalities }
    },
  }) } as unknown as Context
  assert.equal(await modelSupportsVision(ctx, agent), true)
  modalities = ['text']
  await assert.rejects(assertVisionOrHint(ctx, agent), /不支持图片输入/)
  modalities = undefined
  assert.equal(await modelSupportsVision(ctx, agent), null)
  const failure = { get: () => ({ resolveModelInfo: async () => { throw new Error('offline') } }) } as unknown as Context
  assert.equal(await modelSupportsVision(failure, agent), null)
  await assert.rejects(modelSupportsVision(ctx, agent, AbortSignal.abort()), { name: 'AbortError' })
})

test('native prompt submission remains bound to the initiating session and propagates failures', async () => {
  const sent: string[] = []
  let closed = false
  const sessions = {
    using: async (id: string, options: { source: string }, operation: (ref: SessionReference) => Promise<void>) => {
      assert.equal(options.source, 'dsh-bcc')
      if (closed) throw new Error('原会话已关闭')
      await operation({ ready: Promise.resolve({ ctx: {
        conversation: { send: async (text: string) => { sent.push(`${id}:${text}`) } },
      } }) } as unknown as SessionReference)
    },
  } as unknown as ISessions
  const ctx = { get: () => sessions } as unknown as Context
  const send = createPromptSender(ctx, SessionId('original-session'))
  await send('拆剧本')
  assert.deepEqual(sent, ['original-session:拆剧本'])
  closed = true
  await assert.rejects(send('拆分镜'), /原会话已关闭/)
  const failed = { get: () => ({ using: async () => { throw new Error('send failed') } }) } as unknown as Context
  await assert.rejects(createPromptSender(failed, SessionId('session'))('start'), /send failed/)
})

test('panel and command rows register against real DSH slots without SessionList.current', () => {
  const core = new SlotCore()
  core.register({ name: 'root', children: {
    'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
    'conversation.chat.commandview': { kind: 'keyed', scope: 'session' },
  } }, (() => null) as never)
  const ctx = {
    slots: {
      inject: (_name: keyof SlotMap, effect: () => unknown) => effect(),
      register: core.register.bind(core),
    },
  } as unknown as Context
  registerDock(ctx)
  registerCommandViews(ctx)
  assert.equal(core.entries('conversation.chat.commandview').length, 2)
  const header = core.entries('conversation.session.header.utilities')[0]
  setDockOpen(true)
  try {
    const html = renderToStaticMarkup(React.createElement(header.component as React.ComponentType<Record<string, unknown>>, {
      sessionId: 'selected-session',
      useSessions: (select: (state: unknown) => unknown) => select({ byId: { 'selected-session': { cwd: '/original' } } }),
      useProjection: () => '/current',
      sendPrompt: async () => {},
    }))
    assert.match(html, /data-bcc-dock="open"/)
    assert.match(html, /拆剧本/)
  } finally {
    setDockOpen(false)
  }
})

test('real DSH tool pipeline registers, renders image references, and exports relative to workspace', async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'dsh-bcc-compat-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  registerTools(ctx, () => ({ maxShots: 200, cut: DEFAULT_CUT_PARAMS }))
  assert.equal(ctx.tools.schemas().length, 10)
  const frame = path.join(cwd, 'frame.jpg')
  await writeFile(frame, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))
  const project = await createProject({ cwd, videoPath: path.join(cwd, 'clip.mp4'), durationSec: 1, cutParams: DEFAULT_CUT_PARAMS,
    shots: [{ index: 1, startSec: 0, endSec: 1, frame, score: 0 }],
  })
  const attachments = {
    async saveImages(inputs: { data: Uint8Array; name: string }[]) {
      assert.equal(this, attachments, 'batch save must retain its service receiver')
      return inputs.map((input) => ({ attachmentId: 'frame-ref', mediaType: 'image/jpeg', bytes: input.data.length, width: 1, height: 1, name: input.name }))
    },
  }
  ctx.provide('attachments', attachments as unknown as Context['attachments'])
  const invoke = (name: string, args: Record<string, unknown>) => ctx.tools.execute({
    name, arguments: args, callId: ToolCallId(name), signal: new AbortController().signal,
  })
  const frames = await invoke('bcc_read_frames', { cwd, projectId: project.id, source: 'shots' })
  assert.equal(frames.isError, false, JSON.stringify(frames))
  assert.equal(frames.content.filter((block) => block.type === 'image').length, 1)
  ctx.provide('llm', {
    async resolveModelInfo(provider: string, model: string) {
      assert.equal(provider, 'session-provider')
      return { inputModalities: model === 'text-only' ? ['text'] : ['text', 'image'] }
    },
  } as unknown as Context['llm'])
  for (const model of ['gemini-4-argon', 'deepseek-flash', 'kimi-k3.1-pro', 'text-only']) {
    await t.test(`session model ${model} uses the host's declared image capability`, async () => {
      const result = await ctx.tools.execute({
        name: 'bcc_read_frames', arguments: { cwd, projectId: project.id, source: 'shots' },
        callId: ToolCallId(model), signal: new AbortController().signal, agent: fakeAgent(cwd, model),
      })
      assert.equal(result.isError, model === 'text-only', JSON.stringify(result))
      assert.equal(result.content.filter((block) => block.type === 'image').length, model === 'text-only' ? 0 : 1)
    })
  }
  const list = await invoke('bcc_project_list', { cwd })
  assert.equal(list.isError, false)
  assert.match(JSON.stringify(list.value), new RegExp(project.id))
  const script = '[00:00] 1-1 办公室 日/内\n△ 主角抬头。\n【画面未见对白】'
  await writeFile(path.join(cwd, 'script.md'), script)
  const exported = await invoke('bcc_export', { cwd, kind: 'script', from: 'script.md', out: 'exports', format: 'md,docx' })
  assert.equal(exported.isError, false, JSON.stringify(exported))
  assert.equal(await readFile(path.join(cwd, 'exports', 'script.md'), 'utf8'), script)
  assert.equal((await readFile(path.join(cwd, 'exports', 'script.docx'))).subarray(0, 2).toString(), 'PK')
})
