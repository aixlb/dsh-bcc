import type { Context } from '@deepseek-ai/cordis'
import { SCRIPT_COMMAND, STORYBOARD_COMMAND } from './command-names.js'

interface CommandInvocation {
  readonly rawInput: string
}

interface CommandResult {
  kind: 'success' | 'error'
  text?: string
}

interface CommandDefinition {
  readonly name: string
  readonly description: string
  readonly input?: { readonly hint: string; readonly images?: boolean }
  readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>
}

interface CommandsLike {
  register(definition: CommandDefinition): unknown
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    commands: CommandsLike
  }
}

export function registerBccCommands(ctx: Context): void {
  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: SCRIPT_COMMAND,
      description: '拆剧本：选择视频后自动解析整片',
      input: { hint: '可选：视频绝对路径' },
      handler: ({ rawInput }) => ({
        kind: 'success',
        text: rawInput.trim() || '选择一个视频开始拆剧本。',
      }),
    })
    commandCtx.commands.register({
      name: STORYBOARD_COMMAND,
      description: '拆分镜：配置技能、分镜类型与切割方式',
      input: { hint: '可选：视频绝对路径' },
      handler: ({ rawInput }) => ({
        kind: 'success',
        text: rawInput.trim() || '配置分镜参数并选择视频。',
      }),
    })
  })
}
