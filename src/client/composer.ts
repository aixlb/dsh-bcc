import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { PromptSender } from './types.js'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    'dsh-bcc': unknown
  }
}

export async function uploadVideo(file: File, cwd?: string): Promise<{ path: string; size: number }> {
  const qs = new URLSearchParams({ name: file.name })
  if (cwd) qs.set('cwd', cwd)
  const res = await fetch(`/bcc/api/upload?${qs}`, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })
  const body = await res.json().catch(() => ({})) as { path?: string; size?: number; error?: string }
  if (!res.ok || !body.path) {
    throw new Error(body.error || `上传失败 HTTP ${res.status}`)
  }
  return { path: body.path, size: body.size ?? file.size }
}

/** Bind submission to the initiating session, even if navigation changes during upload. */
export function createPromptSender(ctx: Context, sessionId: SessionId): PromptSender {
  return async (text) => {
    // Host and Client both name their different session services `sessions`.
    const sessions = ctx.get('sessions') as unknown as ISessions
    await sessions.using(sessionId, { source: 'dsh-bcc' }, async (reference) => {
      const binding = await reference.ready
      await binding.ctx.conversation.send(text)
    })
  }
}

export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.mkv,.webm,.m4v,.avi'
