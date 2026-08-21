export interface SlotOptions {
  name: string
  key?: string
  id?: string
  order?: number
  label?: string
  inject?: (sessionId: string) => Record<string, unknown>
}

export interface SlotsLike {
  inject(name: string, register: () => unknown): void
  register(options: SlotOptions, component: unknown): unknown
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: SlotsLike
  }
}
