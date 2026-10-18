import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import './types.js'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PromptSender } from './types.js'
import { createPromptSender } from './composer.js'
import { setDockOpen, toggleDock, useDockOpen } from './dock-store.js'
import { ProjectPanel } from './project-panel.js'

type HeaderProps = PropsRuntime<'conversation.session.header.utilities'> & { sendPrompt: PromptSender }

export function registerDock(ctx: Context): void {
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
    {
      name: 'conversation.session.header.utilities', id: 'dsh-bcc', order: 40,
      inject: (sessionId) => ({ sendPrompt: createPromptSender(ctx, sessionId) }),
    },
    HeaderToggle,
  ))
}

function HeaderToggle(props: HeaderProps): React.ReactElement {
  const open = useDockOpen()
  const originalCwd = props.useSessions((s) => s.byId[props.sessionId]?.cwd ?? '')
  const cwd = props.useProjection('workingDirectory') || originalCwd
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'button',
      {
        type: 'button',
        className: open ? 'bcc-header-btn bcc-header-btn-on' : 'bcc-header-btn',
        title: '包拆拆项目与切镜设置',
        'aria-pressed': open,
        onClick: () => toggleDock(),
      },
      '包拆拆',
    ),
    open ? React.createElement(
      'aside',
      { className: 'bcc-dock', 'data-bcc-dock': 'open' },
      React.createElement(ProjectPanel, {
        key: `${props.sessionId}:${cwd}`,
        cwd,
        sendPrompt: props.sendPrompt,
        onCollapse: () => setDockOpen(false),
      }),
    ) : null,
  )
}
