import { useEffect, useState } from 'react'

const OPEN_KEY = 'dsh-bcc.dock-open'

type Listener = () => void

let open = false
try {
  open = localStorage.getItem(OPEN_KEY) === '1'
} catch {
  open = false
}

const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function isDockOpen(): boolean {
  return open
}

export function setDockOpen(next: boolean): void {
  if (open === next) return
  open = next
  try {
    localStorage.setItem(OPEN_KEY, next ? '1' : '0')
  } catch {
    /* ignore quota */
  }
  emit()
}

export function toggleDock(): void {
  setDockOpen(!open)
}

export function useDockOpen(): boolean {
  const [value, setValue] = useState(open)
  useEffect(() => {
    const listener = (): void => setValue(open)
    listeners.add(listener)
    listener()
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return value
}
