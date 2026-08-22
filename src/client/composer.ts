export async function uploadVideo(file: File): Promise<{ path: string; size: number }> {
  const res = await fetch(`/bcc/api/upload?name=${encodeURIComponent(file.name)}`, {
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

function composerRoot(): ParentNode {
  return document.querySelector('[data-pane="conversation"]') ?? document
}

function findDraft(): HTMLTextAreaElement | HTMLElement | null {
  const root = composerRoot()
  return root.querySelector('textarea:not([disabled])')
    ?? root.querySelector('[contenteditable="true"]')
}

function findSendButton(): HTMLButtonElement | null {
  const root = composerRoot()
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
  const labeled = buttons.find((b) => {
    const label = `${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`
    return /发送|send/i.test(label)
  })
  if (labeled) return labeled
  const submits = buttons.filter((b) => b.type === 'submit' && !b.disabled)
  return submits.at(-1) ?? null
}

function writeDraft(el: HTMLTextAreaElement | HTMLElement, text: string): void {
  el.focus()
  if (el instanceof HTMLTextAreaElement) {
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
    desc?.set?.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return
  }
  try {
    document.execCommand('selectAll', false)
    document.execCommand('insertText', false, text)
  } catch {
    el.textContent = text
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }))
  }
}

/** Put text in the live composer and click Send. Best-effort against the stock DSH composer. */
export async function fillAndSend(text: string): Promise<void> {
  const draft = findDraft()
  if (!draft) throw new Error('找不到聊天输入框，请手动粘贴提示词发送。')
  writeDraft(draft, text)
  await new Promise((r) => setTimeout(r, 60))
  const send = findSendButton()
  if (send) {
    send.click()
    return
  }
  draft.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true,
  }))
}

export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.mkv,.webm,.m4v,.avi'
