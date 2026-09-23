import { create } from 'zustand'
import { useJourney } from '../store/useJourney'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { useOrchestration } from '../store/useOrchestration'
import { savedToLibraryCopy } from '../library/review'
import { planIntro, planProposeIntro, type PlanBeat } from './JourneyPlan'
import { spotlightForWidget, type SpotlightId } from './spotlight'

export type PromptTurn = 'kind' | 'guide' | 'propose' | 'plan' | 'done' | 'library' | 'upload'

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
  /** Drop inline widgets so a rejected path doesn’t leave an empty strip in chat. */
  clearWidgets: (widget: NonNullable<CopilotLine['widget']>) => void
  reset: () => void
}

let n = 0

/** Recap after an upload confirm — propose first unless the canvas is already open. */
export function landUploadedPlan() {
  const live = useJourney.getState().file
  const saved = live.artifact
    ? useMerchantLibrary.getState().templates.find((t) => t.checksum === live.artifact?.checksum)
    : undefined
  const { say, setTurn, setBeat } = useCopilotThread.getState()
  const orch = useOrchestration.getState()
  if (!orch.setupDoor) {
    useOrchestration.setState({ setupDoor: 'upload', setupDoorConsumed: true, assistantOpen: true })
  }
  const savedLine = savedToLibraryCopy(saved?.name ?? live.name, saved?.stepLabels ?? [])
  if (orch.stepStripShown) {
    say('bot', [savedLine, planIntro(live)].join('\n\n'), { widget: 'plan' })
    orch.markStepStripShown()
    setTurn('plan')
    setBeat('walk')
    return
  }
  say('bot', [savedLine, planProposeIntro(live)].join('\n\n'), { widget: 'steps' })
  setTurn('propose')
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
      // The step-chain strip no longer flashes a look-here ring the first time
      // it appears — it now animates its cards in instead. Only an explicit
      // `look` (or another widget like the plan card) points the merchant.
      const look = opts.look ?? (opts.widget === 'steps' ? null : spotlightForWidget(opts.widget))
      if (look) useOrchestration.getState().setSpotlight(look)
    }
  },
  setTurn: (turn) => set({ turn }),
  setBeat: (beat) => set({ beat }),
  clearWidgets: (widget) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.widget === widget ? { ...l, widget: undefined } : l)),
    })),
  reset: () => {
    useOrchestration.getState().setSpotlight(null)
    set({ lines: [], turn: 'kind', beat: 'walk' })
  },
}))
