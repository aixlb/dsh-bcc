import type { Context } from '@deepseek-ai/cordis'
import './types.js'
import { injectStyles } from './styles.js'
import { registerCommandViews } from './commandview.js'

export const inject = ['slots']

export function apply(ctx: Context): void {
  injectStyles()
  registerCommandViews(ctx)
}
