// Use the host's public contracts so interface changes fail typechecking.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-session-projection/types'

// Optional projection: a 0.2.0 host returns undefined for this key.
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    workingDirectory: string | null
  }
}

export type PromptSender = (text: string) => Promise<void>
