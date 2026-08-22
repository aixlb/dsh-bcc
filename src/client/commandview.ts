import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import './types.js'
import { SCRIPT_COMMAND, STORYBOARD_COMMAND } from '../command-names.js'
import { VIDEO_ACCEPT, fillAndSend, uploadVideo } from './composer.js'
import {
  DEFAULT_STORYBOARD_CONFIG,
  loadStoryboardConfig,
  saveStoryboardConfig,
  scriptPrompt,
  storyboardPrompt,
  type StoryboardUiConfig,
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
  const hinted = props.node?.args?.trim() || ''
  return React.createElement(VideoStartPanel, {
    title: '拆剧本',
    hint: hinted,
    buildPrompt: (videoPath: string) => scriptPrompt(videoPath),
  })
}

function StoryboardCommandRow(props: { node?: CommandNodeLike }): React.ReactElement {
  const hinted = props.node?.args?.trim() || ''
  const [cfg, setCfg] = React.useState<StoryboardUiConfig>(() => loadStoryboardConfig())
  const patch = (partial: Partial<StoryboardUiConfig>): void => {
    const next = { ...cfg, ...partial }
    setCfg(next)
    saveStoryboardConfig(next)
  }

  return React.createElement(
    'div',
    { className: 'bcc-cmd' },
    React.createElement('div', { className: 'bcc-cmd-title' }, '拆分镜'),
    field('技能', React.createElement('select', {
      value: cfg.skill,
      onChange: () => patch({ skill: 'bcc-storyboard' }),
    }, React.createElement('option', { value: 'bcc-storyboard' }, 'bcc-storyboard'))),
    field('大师', React.createElement('select', {
      value: cfg.master,
      onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => patch({ master: ev.target.value as StoryboardUiConfig['master'] }),
    },
      React.createElement('option', { value: '' }, '无'),
      React.createElement('option', { value: 'shanzhiyin' }, '山之音'),
    )),
    field('分镜类型', React.createElement('select', {
      value: cfg.shotStyle,
      onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => patch({ shotStyle: ev.target.value as StoryboardUiConfig['shotStyle'] }),
    },
      React.createElement('option', { value: 'full7' }, '标准七段提示词'),
      React.createElement('option', { value: 'simple' }, '简版（景别/运镜/描述）'),
    )),
    field('切割方式', React.createElement('select', {
      value: cfg.cutMethod,
      onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => patch({ cutMethod: ev.target.value as StoryboardUiConfig['cutMethod'] }),
    },
      React.createElement('option', { value: 'smart' }, 'smart 混合检测'),
      React.createElement('option', { value: 'scene' }, 'scene 帧差阈值'),
    )),
    cfg.cutMethod === 'smart'
      ? React.createElement(React.Fragment, null,
        field('硬切灵敏度', numInput(cfg.hardMin, (n) => patch({ hardMin: n }), 0.5, 30, 0.5)),
        field('最小间隔(秒)', numInput(cfg.minGap, (n) => patch({ minGap: n }), 0.05, 2, 0.05)),
      )
      : field('差异阈值', numInput(cfg.threshold, (n) => patch({ threshold: n }), 0.05, 0.9, 0.05)),
    field('最多镜数', numInput(cfg.maxShots, (n) => patch({ maxShots: n }), 20, 400, 10)),
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'bcc-cmd-reset',
        onClick: () => {
          setCfg({ ...DEFAULT_STORYBOARD_CONFIG })
          saveStoryboardConfig(DEFAULT_STORYBOARD_CONFIG)
        },
      },
      '恢复默认',
    ),
    React.createElement(VideoStartPanel, {
      title: '',
      hint: hinted,
      buildPrompt: (videoPath: string) => storyboardPrompt(videoPath, cfg),
    }),
  )
}

function VideoStartPanel(props: {
  title: string
  hint: string
  buildPrompt: (videoPath: string) => string
}): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [path, setPath] = React.useState(props.hint)

  const run = async (videoPath: string): Promise<void> => {
    setBusy(true)
    setErr(null)
    try {
      await fillAndSend(props.buildPrompt(videoPath))
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
      await fillAndSend(props.buildPrompt(uploaded.path))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return React.createElement(
    'div',
    { className: 'bcc-cmd-start' },
    props.title ? React.createElement('div', { className: 'bcc-cmd-title' }, props.title) : null,
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
      : React.createElement('div', { className: 'bcc-muted' }, '从本机选择视频，上传到工作区后自动开始。'),
    React.createElement(
      'div',
      { className: 'bcc-cmd-actions' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'bcc-pop-go',
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
            className: 'bcc-cmd-reset',
            disabled: busy,
            onClick: () => void run(path),
          },
          '用该路径开始',
        )
        : null,
    ),
    err ? React.createElement('div', { className: 'bcc-chip-err' }, err) : null,
  )
}

function field(label: string, control: React.ReactNode): React.ReactElement {
  return React.createElement(
    'label',
    { className: 'bcc-pop-row' },
    React.createElement('span', null, label),
    control,
  )
}

function numInput(
  value: number,
  onChange: (n: number) => void,
  min: number,
  max: number,
  step: number,
): React.ReactElement {
  return React.createElement('input', {
    type: 'number',
    value,
    min,
    max,
    step,
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseFloat(ev.target.value)
      if (Number.isFinite(n)) onChange(n)
    },
  })
}
