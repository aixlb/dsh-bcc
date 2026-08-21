import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import '../types.js'

interface Shot {
  index: number
  startSec: number
  endSec: number
  frame?: string
  kind?: string
}

interface Project {
  id: string
  name: string
  videoPath: string
  durationSec: number
  shots: Shot[]
  framesDir?: string
  scriptPath?: string
  storyboardPath?: string
}

function mediaUrl(file: string, extra = ''): string {
  return `/bcc/media?path=${encodeURIComponent(file)}${extra}`
}

export function registerWorkbench(ctx: Context): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    {
      name: 'conversation.view',
      key: 'bcc',
      id: 'dsh-bcc',
      label: '包拆拆',
      order: 30,
    },
    Workbench,
  ))
}

function Workbench(): React.ReactElement {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [project, setProject] = React.useState<Project | null>(null)
  const [shotIndex, setShotIndex] = React.useState(1)
  const [error, setError] = React.useState<string | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const reload = React.useCallback(() => {
    fetch('/bcc/api/projects')
      .then((r) => r.json())
      .then((body: { projects?: Project[] }) => {
        setProjects(body.projects ?? [])
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  React.useEffect(() => {
    reload()
    const t = setInterval(reload, 2500)
    return () => clearInterval(t)
  }, [reload])

  React.useEffect(() => {
    if (!activeId) {
      setProject(null)
      return
    }
    fetch(`/bcc/api/projects/${encodeURIComponent(activeId)}`)
      .then((r) => r.json())
      .then((body: Project) => {
        setProject(body)
        setShotIndex(1)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [activeId, projects])

  const activeShot = project?.shots.find((s) => s.index === shotIndex)

  React.useEffect(() => {
    if (activeShot && videoRef.current) {
      videoRef.current.currentTime = activeShot.startSec
    }
  }, [activeShot?.startSec])

  return React.createElement(
    'div',
    { className: 'bcc-workbench' },
    error ? React.createElement('div', { className: 'bcc-banner' }, error) : null,
    React.createElement(
      'div',
      { className: 'bcc-col' },
      React.createElement('h3', { className: 'bcc-title' }, '项目'),
      projects.length === 0
        ? React.createElement('p', { className: 'bcc-muted' }, '还没有项目。在对话里把视频路径发给 Agent，让它调用 bcc_shots。')
        : projects.map((p) => React.createElement(
          'button',
          {
            key: p.id,
            type: 'button',
            className: 'bcc-item',
            'data-active': p.id === activeId ? 'true' : 'false',
            onClick: () => setActiveId(p.id),
          },
          React.createElement('div', null, p.name),
          React.createElement('div', { className: 'bcc-muted' }, `${p.shots?.length ?? 0} 镜`),
        )),
    ),
    React.createElement(
      'div',
      { className: 'bcc-col' },
      React.createElement('h3', { className: 'bcc-title' }, '预览'),
      project
        ? React.createElement(
          React.Fragment,
          null,
          React.createElement('video', {
            ref: videoRef,
            className: 'bcc-video',
            src: mediaUrl(project.videoPath, '&video=1'),
            controls: true,
          }),
          React.createElement(
            'div',
            { className: 'bcc-timeline' },
            (project.shots ?? []).map((s) => React.createElement('button', {
              key: s.index,
              type: 'button',
              className: 'bcc-shot',
              title: `#${s.index} ${s.startSec.toFixed(1)}s`,
              'data-active': s.index === shotIndex ? 'true' : 'false',
              style: { flexGrow: Math.max(0.15, s.endSec - s.startSec) },
              onClick: () => setShotIndex(s.index),
            })),
          ),
          React.createElement('p', { className: 'bcc-muted' },
            activeShot
              ? `第 ${activeShot.index} 镜 ${activeShot.startSec.toFixed(2)}s–${activeShot.endSec.toFixed(2)}s${activeShot.kind ? ` · ${activeShot.kind}` : ''}`
              : '选择一个镜头'),
        )
        : React.createElement('p', { className: 'bcc-muted' }, '从左侧打开一个项目。可用聊天调整切镜：例如「切太碎了，min-gap 调到 0.5」。'),
    ),
    React.createElement(
      'div',
      { className: 'bcc-col bcc-process' },
      React.createElement('h3', { className: 'bcc-title' }, '过程'),
      project
        ? React.createElement(
          React.Fragment,
          null,
          React.createElement('div', { className: 'bcc-muted' }, `时长 ${project.durationSec.toFixed(1)}s · ${project.shots.length} 镜`),
          project.scriptPath ? React.createElement('div', null, '已有剧本') : React.createElement('div', { className: 'bcc-muted' }, '尚无剧本'),
          project.storyboardPath ? React.createElement('div', null, '已有分镜表') : React.createElement('div', { className: 'bcc-muted' }, '尚无分镜表'),
          activeShot?.frame
            ? React.createElement('img', { className: 'bcc-thumb', src: mediaUrl(activeShot.frame), alt: `shot ${activeShot.index}` })
            : React.createElement('p', { className: 'bcc-muted' }, '当前镜无关键帧'),
        )
        : React.createElement('p', { className: 'bcc-muted' }, '切镜、抽帧、逐镜分析的进度会出现在这里。'),
    ),
  )
}
