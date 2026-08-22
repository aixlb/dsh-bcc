import type { Context } from '@deepseek-ai/cordis'
import { Config, type PluginConfig } from './config.js'
import { registerTools } from './tools/register.js'
import { registerSkills } from './skills/register.js'
import { registerHttp } from './http/register.js'
import { registerBccCommands } from './commands.js'

export const name = 'dsh-bcc'
export const inject = ['tools']
export { Config }
export type { PluginConfig }

export function apply(ctx: Context, config: PluginConfig): void {
  const configOf = (): PluginConfig => config
  registerTools(ctx, configOf)
  registerBccCommands(ctx)

  ctx.inject(['skills'], (scoped) => {
    registerSkills(scoped)
  })
  ctx.inject(['webServer'], (scoped) => {
    registerHttp(scoped)
  })
}
