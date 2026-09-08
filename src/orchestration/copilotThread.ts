import { create } from 'zustand'

/** One bubble in Chargebee Copilot, including questions asked from the canvas. */
export interface CopilotLine {
  id: string
  from: 'bot' | 'you'
  text: string
  /** Element the merchant pointed at, when this came from annotate. */
  ref?: string
}

interface CopilotThread {
  lines: CopilotLine[]
  say: (from: CopilotLine['from'], text: string, ref?: string) => void
  reset: () => void
}

let n = 0

export const useCopilotThread = create<CopilotThread>((set) => ({
  lines: [],
  say: (from, text, ref) =>
    set((s) => ({
      lines: [...s.lines, { id: `${Date.now()}-${n++}`, from, text, ...(ref ? { ref } : {}) }],
    })),
  reset: () => set({ lines: [] }),
}))
