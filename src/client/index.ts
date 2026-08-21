import type { Context } from '@deepseek-ai/cordis'
import './types.js'
import { injectStyles } from './styles.js'
import { registerWorkbench } from './workbench/view.js'
import { registerSidebarAction } from './sidebar-action.js'

export const inject = ['slots']

export function apply(ctx: Context): void {
  injectStyles()
  registerWorkbench(ctx)
  registerSidebarAction(ctx)
}
