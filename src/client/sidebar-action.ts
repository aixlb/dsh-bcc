import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import './types.js'

export function registerSidebarAction(ctx: Context): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'dsh-bcc', order: 40 },
    SidebarAction,
  ))
}

function SidebarAction(props: { wide?: boolean }): React.ReactElement {
  return React.createElement(
    'button',
    {
      type: 'button',
      className: 'bcc-sidebar-action',
      title: '打开包拆拆工作台',
      onClick: () => {
        const btn = document.querySelector('[data-slot="conversation.view"] [data-key="bcc"], button[aria-label="包拆拆"]')
        if (btn instanceof HTMLElement) btn.click()
      },
    },
    React.createElement('span', null, '🎬'),
    props.wide === false ? null : React.createElement('span', null, '包拆拆'),
  )
}
