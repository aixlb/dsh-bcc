import React, { useEffect, useRef, useState } from 'react'
import { fetchProject, fetchProjects, mediaUrl, patchProject, type ProjectSummary } from './api.js'
import { fillAndSend, uploadVideo, VIDEO_ACCEPT } from './composer.js'
import { NumberInput, SelectField, TextArea, TextInput } from './widgets.js'
import {
  applyCutParams,
  cutParamsFromUi,
  DEFAULT_SCRIPT_CONFIG,
  DEFAULT_STORYBOARD_CONFIG,
  DEFAULT_UI,
  loadUiState,
  saveUiState,
  startPrompt,
  type BccMode,
  type BccUiState,
  type MasterId,
  type ScriptUiConfig,
  type ShotStyle,
  type StoryboardUiConfig,
} from './prefs.js'

export function ProjectPanel(props: { cwd: string; onCollapse: () => void }): React.ReactElement {
  const { cwd } = props
  const [ui, setUi] = useState<BccUiState>(() => loadUiState())
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const saveTimer = useRef<number | null>(null)

  const commit = (next: BccUiState, persistProject = true): void => {
    setUi(next)
    saveUiState(next)
    if (!persistProject || !next.projectId || !cwd) return
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void patchProject(next.projectId, cwd, {
        videoPath: next.videoPath.trim() || undefined,
        cutParams: {
          ...cutParamsFromUi(next.storyboard),
          interval_sec: next.script.intervalSec,
        },
        shotStyle: next.storyboard.shotStyle,
        scriptMaster: next.scriptMaster,
        storyboardMaster: next.storyboard.master,
        extractPrompt: next.script.extractPrompt,
        mergePrompt: next.script.mergePrompt,
      }).catch(() => { /* keep local prefs even if disk write fails */ })
    }, 450)
  }

  const patch = (partial: Partial<BccUiState>): void => {
    commit({ ...ui, ...partial })
  }

  const patchBoard = (partial: Partial<StoryboardUiConfig>): void => {
    commit({ ...ui, storyboard: { ...ui.storyboard, ...partial, skill: 'bcc-storyboard' } })
  }

  const patchScript = (partial: Partial<ScriptUiConfig>): void => {
    commit({ ...ui, script: { ...ui.script, ...partial } })
  }

  const refreshProjects = async (preferId?: string): Promise<void> => {
    if (!cwd) return
    try {
      const list = await fetchProjects(cwd)
      setProjects(list)
      const id = preferId || ui.projectId
      const matched = (id && list.find((p) => p.id === id))
        || list.find((p) => p.videoPath && p.videoPath === (ui.videoPath || '').trim())
      if (matched) applyProject(await fetchProject(matched.id, cwd), false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refreshProjects()
    return () => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd])

  const applyProject = (project: ProjectSummary, persist = true): void => {
    const next: BccUiState = {
      ...ui,
      projectId: project.id,
      videoPath: project.videoPath || ui.videoPath,
      scriptMaster: (project.scriptMaster as MasterId) || ui.scriptMaster,
      script: {
        ...ui.script,
        intervalSec: project.cutParams?.interval_sec || ui.script.intervalSec,
        extractPrompt: project.extractPrompt?.trim() ? project.extractPrompt : ui.script.extractPrompt,
        mergePrompt: project.mergePrompt?.trim() ? project.mergePrompt : ui.script.mergePrompt,
      },
      storyboard: {
        ...applyCutParams(ui.storyboard, project.cutParams ?? {}),
        shotStyle: project.shotStyle === 'simple' || project.shotStyle === 'full7' ? project.shotStyle : ui.storyboard.shotStyle,
        master: (project.storyboardMaster as MasterId) || ui.storyboard.master,
        skill: 'bcc-storyboard',
      },
    }
    commit(next, persist)
  }

  const onPickProject = async (id: string): Promise<void> => {
    if (!id) {
      patch({ projectId: '' })
      return
    }
    setErr(null)
    try {
      applyProject(await fetchProject(id, cwd))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setBusy(true)
    setErr(null)
    try {
      const uploaded = await uploadVideo(file, cwd)
      commit({ ...ui, videoPath: uploaded.path, projectId: ui.projectId })
      await refreshProjects()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const run = async (mode?: BccMode): Promise<void> => {
    const next = mode ? { ...ui, mode } : ui
    if (mode) commit(next)
    setBusy(true)
    setErr(null)
    try {
      await fillAndSend(startPrompt(next))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const selected = projects.find((p) => p.id === ui.projectId)
  const video = ui.videoPath.trim()

  return React.createElement(
    'div',
    { className: 'bcc-dock-body' },
    React.createElement(
      'header',
      { className: 'bcc-dock-head' },
      React.createElement('div', { className: 'bcc-dock-title' }, '包拆拆'),
      React.createElement(
        'button',
        { type: 'button', className: 'bcc-dock-icon', title: '收起', onClick: props.onCollapse },
        '›',
      ),
    ),
    section('当前项目',
      field('项目', React.createElement(
        'div',
        { className: 'bcc-cmd-actions' },
        React.createElement(SelectField, {
          value: ui.projectId,
          options: [
            { value: '', label: '未关联（上传或开拆后自动建）' },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ],
          onChange: (id) => void onPickProject(id),
        }),
        React.createElement(
          'button',
          { type: 'button', className: 'bcc-btn bcc-btn-ghost', onClick: () => void refreshProjects() },
          '刷新',
        ),
      )),
      selected
        ? React.createElement('div', { className: 'bcc-muted' }, metaLine(selected))
        : null,
    ),
    section('视频',
      field('地址', React.createElement(TextInput, {
        value: ui.videoPath,
        placeholder: '绝对路径，或从本机选择',
        onChange: (videoPath) => patch({ videoPath }),
      })),
      React.createElement('input', {
        ref: inputRef,
        type: 'file',
        accept: VIDEO_ACCEPT,
        hidden: true,
        onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void onFile(ev.target.files?.[0]),
      }),
      React.createElement(
        'div',
        { className: 'bcc-cmd-actions' },
        React.createElement(
          'button',
          { type: 'button', className: 'bcc-btn bcc-btn-ghost', disabled: busy, onClick: () => inputRef.current?.click() },
          busy ? '处理中…' : '选择视频',
        ),
      ),
      video
        ? React.createElement('video', {
          className: 'bcc-dock-video',
          src: mediaUrl(video, cwd),
          controls: true,
          preload: 'metadata',
        })
        : null,
    ),
    section('任务',
      segment<BccMode>(ui.mode, [
        { value: 'script', label: '拆剧本' },
        { value: 'storyboard', label: '拆分镜' },
      ], (mode) => patch({ mode })),
    ),
    ui.mode === 'script'
      ? section('剧本设置',
        field('切镜间隔(秒)', hintNum(ui.script.intervalSec, (intervalSec) => patchScript({ intervalSec }), 0.2, 10, 0.1, '默认 1 秒。每隔该秒数切一刀，看完后再按合并提示词合成剧本')),
        field('最多镜数', hintNum(ui.script.maxShots, (maxShots) => patchScript({ maxShots }), 20, 2000, 10, '间隔切默认 1200，超限会拉大步长以免丢掉片尾')),
        field('大师', masterSelect(ui.scriptMaster, (scriptMaster) => patch({ scriptMaster }))),
        field('提取提示词', React.createElement(TextArea, {
          value: ui.script.extractPrompt,
          rows: 10,
          onChange: (extractPrompt) => patchScript({ extractPrompt }),
        })),
        field('合并提示词', React.createElement(TextArea, {
          value: ui.script.mergePrompt,
          rows: 10,
          onChange: (mergePrompt) => patchScript({ mergePrompt }),
        })),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'bcc-btn bcc-btn-ghost',
            onClick: () => patchScript({
              extractPrompt: DEFAULT_SCRIPT_CONFIG.extractPrompt,
              mergePrompt: DEFAULT_SCRIPT_CONFIG.mergePrompt,
            }),
          },
          '恢复默认提示词',
        ),
      )
      : section('分镜设置',
        field('分镜类型', React.createElement(SelectField, {
          value: ui.storyboard.shotStyle,
          options: [
            { value: 'full7', label: '标准七段提示词' },
            { value: 'simple', label: '简版（景别/运镜/描述）' },
          ],
          onChange: (shotStyle) => patchBoard({ shotStyle: shotStyle as ShotStyle }),
        })),
        field('大师', masterSelect(ui.storyboard.master, (master) => patchBoard({ master }))),
        field('切割方式', segment(ui.storyboard.cutMethod, [
          { value: 'smart', label: '混合检测' },
          { value: 'scene', label: '帧差值' },
        ], (cutMethod) => patchBoard({ cutMethod }))),
        ui.storyboard.cutMethod === 'scene'
          ? field('切点阈值', hintNum(ui.storyboard.threshold, (threshold) => patchBoard({ threshold }), 0.01, 1, 0.01, '每帧差异 > 阈值即切点'))
          : React.createElement(React.Fragment, null,
            field('硬切最低帧差', hintNum(ui.storyboard.hardMin, (hardMin) => patchBoard({ hardMin }), 1, 50, 0.5, '默认 5.5，调低更敏感')),
            field('硬切相对倍率', hintNum(ui.storyboard.hardRatio, (hardRatio) => patchBoard({ hardRatio }), 2, 50, 0.5, '默认 8，排除运镜误报')),
            field('最小切点间隔', hintNum(ui.storyboard.minGap, (minGap) => patchBoard({ minGap }), 0.1, 10, 0.05, '默认 0.3 秒')),
          ),
        field('最大分镜数', hintNum(ui.storyboard.maxShots, (maxShots) => patchBoard({ maxShots }), 10, 500, 10, '默认 200')),
      ),
    React.createElement(
      'div',
      { className: 'bcc-dock-foot' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'bcc-btn bcc-btn-ghost',
          onClick: () => commit({
            ...DEFAULT_UI,
            videoPath: ui.videoPath,
            projectId: ui.projectId,
            storyboard: { ...DEFAULT_STORYBOARD_CONFIG },
          }),
        },
        '恢复默认',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'bcc-btn bcc-btn-primary',
          disabled: busy || !video,
          onClick: () => void run(),
        },
        busy ? '处理中…' : ui.mode === 'script' ? '开始拆剧本' : '开始拆分镜',
      ),
    ),
    err ? React.createElement('div', { className: 'bcc-chip-err' }, err) : null,
  )
}

function metaLine(project: ProjectSummary): string {
  const bits = [`${project.shotCount} 镜`]
  if (project.durationSec > 0) bits.push(formatDur(project.durationSec))
  if (project.hasScript) bits.push('已有剧本')
  if (project.hasStoryboard) bits.push('已有分镜')
  return bits.join(' · ')
}

function formatDur(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function section(title: string, ...children: Array<React.ReactNode>): React.ReactElement {
  return React.createElement(
    'section',
    { className: 'bcc-dock-section' },
    React.createElement('div', { className: 'bcc-dock-section-title' }, title),
    ...children,
  )
}

function field(label: string, control: React.ReactNode): React.ReactElement {
  return React.createElement(
    'div',
    { className: 'bcc-dock-field' },
    React.createElement('span', null, label),
    control,
  )
}

function hintNum(
  value: number,
  onChange: (n: number) => void,
  min: number,
  max: number,
  step: number,
  hint: string,
): React.ReactElement {
  return React.createElement(
    'div',
    { className: 'bcc-dock-num' },
    React.createElement(NumberInput, { value, min, max, step, onChange }),
    React.createElement('div', { className: 'bcc-muted' }, hint),
  )
}

function masterSelect(value: MasterId, onChange: (v: MasterId) => void): React.ReactElement {
  return React.createElement(SelectField, {
    value,
    options: [
      { value: '', label: '无' },
      { value: 'shanzhiyin', label: '山之音' },
    ],
    onChange: (v) => onChange(v as MasterId),
  })
}

function segment<T extends string>(
  value: T,
  options: Array<{ value: T; label: string }>,
  onChange: (value: T) => void,
): React.ReactElement {
  return React.createElement(
    'div',
    { className: 'bcc-seg' },
    ...options.map((opt) => React.createElement(
      'button',
      {
        key: opt.value,
        type: 'button',
        className: value === opt.value ? 'bcc-seg-on' : undefined,
        onClick: () => onChange(opt.value),
      },
      opt.label,
    )),
  )
}
