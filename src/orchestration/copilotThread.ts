import { create } from 'zustand'
import { useJourney } from '../store/useJourney'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { useOrchestration } from '../store/useOrchestration'
import { savedToLibraryCopy } from '../library/review'
import { planIntro, type PlanBeat } from './JourneyPlan'
import { spotlightForWidget, type SpotlightId } from './spotlight'

export type PromptTurn = 'kind' | 'guide' | 'plan' | 'done' | 'library' | 'upload'

/** One bubble in Chargebee Copilot, including questions asked from the canvas. */
export interface CopilotLine {
  id: string
  from: 'bot' | 'you'
  text: string
  /** Element the merchant pointed at, when this came from annotate. */
  ref?: string
  /** Live draft-plan card, rendered inside the thread rather than as a form. */
  widget?: 'plan' | 'steps'
  /** Assistant message that owns an Apply action for this bubble. */
  applyMessageId?: number
}

type SayExtra =
  | string
  | {
      ref?: string
      widget?: CopilotLine['widget']
      applyMessageId?: number
      look?: SpotlightId
    }

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

/** Recap after an upload confirm — chat first, then the walk beat. */
export function landUploadedPlan() {
  const live = useJourney.getState().file
  const saved = live.artifact
    ? useMerchantLibrary.getState().templates.find((t) => t.checksum === live.artifact?.checksum)
    : undefined
  const { say, setTurn, setBeat } = useCopilotThread.getState()
  say(
    'bot',
    [savedToLibraryCopy(saved?.name ?? live.name, saved?.stepLabels ?? []), planIntro(live)].join('\n\n'),
    { widget: 'plan' },
  )
  useOrchestration.getState().markStepStripShown()
  setTurn('plan')
  setBeat('walk')
}

export const useCopilotThread = create<CopilotThread>((set) => ({
  lines: [],
  turn: 'kind',
  beat: 'walk',
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
    if (from === 'bot') {
      const look = opts.look ?? spotlightForWidget(opts.widget)
      if (look) useOrchestration.getState().setSpotlight(look)
    }
  },
  setTurn: (turn) => set({ turn }),
  setBeat: (beat) => set({ beat }),
  reset: () => {
    useOrchestration.getState().setSpotlight(null)
    set({ lines: [], turn: 'kind', beat: 'walk' })
  },
}))
