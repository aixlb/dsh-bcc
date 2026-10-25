import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-llm'
import modelExamples from './model-catalog.json' with { type: 'json' }

// 仅供切换提示展示；实际可用性与图片能力始终读取 DSH 当前模型目录。
export const MODEL_EXAMPLES = modelExamples

export const VISION_REQUIRED_MESSAGE =
  `当前会话模型不支持图片输入，无法看关键帧。请在 DSH 模型设置中添加或选择支持 image 的模型，例如 ${MODEL_EXAMPLES.map((model) => `${model.label}（${model.id}）`).join('、')}。模型可用性以当前账号目录为准。包拆拆不会自动改你的默认模型。`

/**
 * Best-effort: true / false when the live LLM catalog is inspectable, null if unknown.
 * Never writes settings. Callers must prompt, not auto-switch.
 */
export async function modelSupportsVision(ctx: Context, agent?: Agent, signal?: AbortSignal): Promise<boolean | null> {
  signal?.throwIfAborted()
  const llm = ctx.get('llm')
  // The request header identifies the route actually producing this tool call,
  // including model-picker changes, rather than a deployment-wide default.
  const route = agent?.session.requestHeader()?.config ?? agent?.options
  if (!llm || !route?.provider || !route.model) return null
  try {
    const info = await llm.resolveModelInfo(route.provider, route.model, signal)
    signal?.throwIfAborted()
    return info.inputModalities === undefined ? null : info.inputModalities.includes('image')
  } catch {
    signal?.throwIfAborted()
    return null
  }
}

export async function assertVisionOrHint(ctx: Context, agent?: Agent, signal?: AbortSignal): Promise<void> {
  const supported = await modelSupportsVision(ctx, agent, signal)
  if (supported === false) {
    throw new Error(VISION_REQUIRED_MESSAGE)
  }
}
