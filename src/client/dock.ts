import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import './types.js'
import { setDockOpen, toggleDock, useDockOpen } from './dock-store.js'
import { ProjectPanel } from './project-panel.js'

interface SessionList {
  current?: string
  byId: Record<string, { cwd?: string; blank?: boolean }>
}

interface OverlayProps {
  useSessions: (selector: (state: SessionList) => unknown) => unknown
}

interface HeaderProps {
  sessionId: string
}

export function registerDock(ctx: Context): void {
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
    { name: 'conversation.session.header.utilities', id: 'dsh-bcc', order: 40 },
    HeaderToggle,
  ))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'dsh-bcc-dock', order: 40 },
    DockOverlay,
  ))
}

function HeaderToggle(_props: HeaderProps): React.ReactElement {
  const open = useDockOpen()
  return React.createElement(
    'button',
    {
      type: 'button',
      className: open ? 'bcc-header-btn bcc-header-btn-on' : 'bcc-header-btn',
      title: '包拆拆项目与切镜设置',
      'aria-pressed': open,
      onClick: () => toggleDock(),
    },
    '包拆拆',
  )
}

function DockOverlay({ useSessions }: OverlayProps): React.ReactElement | null {
  const open = useDockOpen()
  const session = useSessions((s) => {
    const id = s.current
    if (!id) return null
    const row = s.byId[id]
    if (!row) return null
    return { id, cwd: row.cwd ?? '' }
  }) as { id: string; cwd: string } | null

  if (!session || !open) return null

  return React.createElement(
    'aside',
    { className: 'bcc-dock', 'data-bcc-dock': 'open' },
    React.createElement(ProjectPanel, {
      cwd: session.cwd,
      onCollapse: () => setDockOpen(false),
    }),
  )
}
