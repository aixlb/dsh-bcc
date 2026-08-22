import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import './types.js'
import { SCRIPT_COMMAND, STORYBOARD_COMMAND } from '../command-names.js'
import { VIDEO_ACCEPT, fillAndSend, uploadVideo } from './composer.js'
import { setDockOpen } from './dock-store.js'
import {
  loadUiState,
  saveUiState,
  startPrompt,
  type BccMode,
} from './prefs.js'

interface CommandNodeLike {
  name: string | null
  args: string | null
  outcome: { kind: 'success' | 'error'; text?: string } | null
}

export function registerCommandViews(ctx: Context): void {
  ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register(
    { name: 'conversation.chat.commandview', key: SCRIPT_COMMAND, order: 20 },
    ScriptCommandRow,
  ))
  ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register(
    { name: 'conversation.chat.commandview', key: STORYBOARD_COMMAND, order: 20 },
    StoryboardCommandRow,
  ))
}

function ScriptCommandRow(props: { node?: CommandNodeLike }): React.ReactElement {
  React.useEffect(() => { setDockOpen(true) }, [])
  return React.createElement(VideoStartPanel, {
    title: '拆剧本',
    mode: 'script',
    hint: props.node?.args?.trim() || '',
  })
}

function StoryboardCommandRow(props: { node?: CommandNodeLike }): React.ReactElement {
  React.useEffect(() => { setDockOpen(true) }, [])
  return React.createElement(VideoStartPanel, {
    title: '拆分镜',
    mode: 'storyboard',
    hint: props.node?.args?.trim() || '',
  })
}

function remember(mode: BccMode, videoPath: string): ReturnType<typeof loadUiState> {
  const next = { ...loadUiState(), mode, videoPath }
  saveUiState(next)
  return next
}

function VideoStartPanel(props: {
  title: string
  mode: BccMode
  hint: string
}): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [path, setPath] = React.useState(props.hint || loadUiState().videoPath)

  const run = async (videoPath: string): Promise<void> => {
    setBusy(true)
    setErr(null)
    try {
      await fillAndSend(startPrompt(remember(props.mode, videoPath)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setBusy(true)
    setErr(null)
    try {
      const uploaded = await uploadVideo(file)
      setPath(uploaded.path)
      await fillAndSend(startPrompt(remember(props.mode, uploaded.path)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return React.createElement(
    'div',
    { className: 'bcc-cmd' },
    props.title ? React.createElement('div', { className: 'bcc-cmd-title' }, props.title) : null,
    React.createElement('div', { className: 'bcc-cmd-start' },
    React.createElement('input', {
      ref: inputRef,
      type: 'file',
      accept: VIDEO_ACCEPT,
      hidden: true,
      onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
        void onFile(ev.target.files?.[0])
      },
    }),
    path
      ? React.createElement('div', { className: 'bcc-muted' }, path)
      : React.createElement('div', { className: 'bcc-muted' }, '切镜参数在右侧「包拆拆」面板。从本机选择视频后按当前设置开始。'),
    React.createElement(
      'div',
      { className: 'bcc-cmd-actions' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'bcc-btn bcc-btn-primary',
          disabled: busy,
          onClick: () => inputRef.current?.click(),
        },
        busy ? '处理中…' : '选择视频',
      ),
      path
        ? React.createElement(
          'button',
          {
            type: 'button',
            className: 'bcc-btn bcc-btn-ghost',
            disabled: busy,
            onClick: () => void run(path),
          },
          '用该路径开始',
        )
        : null,
    ),
    err ? React.createElement('div', { className: 'bcc-chip-err' }, err) : null,
    ),
  )
}
