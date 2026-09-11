import { create } from 'zustand'
import type { PlanBeat } from './JourneyPlan'

export type PromptTurn = 'kind' | 'guide' | 'plan' | 'match_site' | 'done'

/** One bubble in Chargebee Copilot, including questions asked from the canvas. */
export interface CopilotLine {
  id: string
  from: 'bot' | 'you'
  text: string
  /** Element the merchant pointed at, when this came from annotate. */
  ref?: string
  /** Live draft-plan card, rendered inside the thread rather than as a form. */
  widget?: 'plan'
  /** Assistant message that owns an Apply action for this bubble. */
  applyMessageId?: number
}

type SayExtra = string | { ref?: string; widget?: 'plan'; applyMessageId?: number }

interface CopilotThread {
  lines: CopilotLine[]
  turn: PromptTurn
  beat: PlanBeat
  say: (from: CopilotLine['from'], text: string, extra?: SayExtra) => void
  setTurn: (turn: PromptTurn) => void
  setBeat: (beat: PlanBeat) => void
  reset: () => void
}

let n = 0

export const useCopilotThread = create<CopilotThread>((set) => ({
  lines: [],
  turn: 'kind',
  beat: 'review',
  say: (from, text, extra) => {
    const opts = typeof extra === 'string' ? { ref: extra } : extra ?? {}
    set((s) => ({
      lines: [
        ...s.lines,
        {
          id: `${Date.now()}-${n++}`,
          from,
          text,
          ...(opts.ref ? { ref: opts.ref } : {}),
          ...(opts.widget ? { widget: opts.widget } : {}),
          ...(opts.applyMessageId != null ? { applyMessageId: opts.applyMessageId } : {}),
        },
      ],
    }))
  },
  setTurn: (turn) => set({ turn }),
  setBeat: (beat) => set({ beat }),
  reset: () => set({ lines: [], turn: 'kind', beat: 'review' }),
}))
