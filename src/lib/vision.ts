import type { Context } from '@deepseek-ai/cordis'

export const RECOMMENDED_MODEL = 'deepseek-v4-flash-vision-exp'

export const VISION_REQUIRED_MESSAGE =
  `当前会话模型不支持图片输入，无法看关键帧。请在 DSH 模型选择器切换到 ${RECOMMENDED_MODEL}（或其它带 image 模态的模型）。包拆拆不会自动改你的默认模型。`

type Modality = string

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function modalitiesOf(model: unknown): Modality[] {
  const rec = asRecord(model)
  if (!rec) return []
  const raw = rec.inputModalities ?? rec.modalities ?? rec.capabilities
  if (Array.isArray(raw)) return raw.map((x) => String(x).toLowerCase())
  return []
}

function idOf(model: unknown): string {
  const rec = asRecord(model)
  if (!rec) return ''
  return String(rec.id ?? rec.model ?? rec.name ?? '')
}

/**
 * Best-effort: true / false when the live LLM catalog is inspectable, null if unknown.
 * Never writes settings. Callers must prompt, not auto-switch.
 */
export function modelSupportsVision(ctx: Context): boolean | null {
  try {
    const llm = (ctx as Context & { get?: (key: string) => unknown }).get?.('llm')
      ?? (ctx as unknown as { llm?: unknown }).llm
    const rec = asRecord(llm)
    if (!rec) return null

    const current =
      rec.currentModel
      ?? rec.activeModel
      ?? (typeof rec.getCurrentModel === 'function' ? rec.getCurrentModel() : undefined)
    if (current) {
      const id = idOf(current).toLowerCase()
      const mods = modalitiesOf(current)
      if (mods.includes('image') || mods.includes('vision')) return true
      if (id.includes('vision')) return true
      if (mods.includes('text') && mods.length === 1) return false
    }

    const models = rec.models ?? rec.catalog
    if (Array.isArray(models)) {
      const vision = models.find((m) => {
        const id = idOf(m).toLowerCase()
        return id.includes('vision') || modalitiesOf(m).includes('image')
      })
      if (!vision) return null
    }
    return null
  } catch {
    return null
  }
}

export function assertVisionOrHint(ctx: Context): void {
  const supported = modelSupportsVision(ctx)
  if (supported === false) {
    throw new Error(VISION_REQUIRED_MESSAGE)
  }
}
