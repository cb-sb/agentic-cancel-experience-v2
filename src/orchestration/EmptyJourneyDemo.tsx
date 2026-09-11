import { useEffect, useMemo, useRef } from 'react'
import { compileJourney } from '../journey/compile'
import { startFromTemplate, withLive } from '../journey/templates'
import { isOutcomeStep } from '../lib/stepColumns'
import { BrandButton, BrandRoot } from '../render/BrandUI'
import { DeviceChrome } from '../render/DeviceChrome'
import {
  RenderProvider,
  defaultRenderActions,
  type RenderCtxValue,
} from '../render/RenderContext'
import { StepFrame } from '../render/StepFrame'
import { StepRenderer } from '../render/StepRenderer'
import { EMPTY_JOURNEY } from '../journey/types'
import type { ConfirmationComponent, Step } from '../types/experience'
import type { PlaySession } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { DEMO_MIN_ZOOM } from './flow/canvasTokens'
import { useCounterScale } from './flow/screen'
import { DEMO_STAGES, useEmptyDemoWalk } from './emptyDemoFlag'

function idleSession(result: PlaySession['result'] = null): PlaySession {
  return {
    index: 0,
    selectedReasonId: null,
    reasonText: {},
    acceptedOfferId: null,
    checkout: { open: false, offerId: null },
    result,
    undone: false,
    confirmInput: '',
    consentChecked: false,
    feedback: '',
  }
}

function PlayFooter({ step }: { step: Step }) {
  const confirmation = step.components.find((c): c is ConfirmationComponent => c.kind === 'confirmation')
  const hasOffer = step.components.some((c) => c.kind === 'offer')
  if (confirmation) {
    return (
      <>
        <BrandButton variant="outline" type="button" tabIndex={-1}>
          {confirmation.keepCta}
        </BrandButton>
        <BrandButton variant="secondary" type="button" tabIndex={-1}>
          {confirmation.cancelCta}
        </BrandButton>
      </>
    )
  }
  const continueLabel = step.navContinueLabel ?? (hasOffer ? 'No thanks, continue cancelling →' : 'Continue')
  return (
    <BrandButton type="button" tabIndex={-1}>
      <span dangerouslySetInnerHTML={{ __html: continueLabel }} />
    </BrandButton>
  )
}
function SideArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled?: boolean
  onClick: () => void
}) {
  const prev = direction === 'prev'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={prev ? 'Previous screen' : 'Next screen'}
      className="relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {prev ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
      </svg>
    </button>
  )
}

/**
 * Canned subscriber walk of cancel_4, previewed in an iPad portrait frame.
 * Compiles in memory — does not write the journey file until the merchant uses
 * Copilot or “Use this flow”.
 *
 * The monitor fills the enclosure and zooms with it. Caption (with the step
 * carousel) is counter-scaled so it stays on-screen size down to DEMO_MIN_ZOOM;
 * the canvas itself cannot recede past that floor, so copy on the device stays
 * readable too. “Use this flow” / “Help me choose” sit under the enclosure.
 */
export function EmptyJourneyDemo() {
  const brand = useJourney((s) => s.file.brand)
  const index = useEmptyDemoWalk((s) => s.index)
  const setIndex = useEmptyDemoWalk((s) => s.setIndex)
  const hover = useRef(false)
  const chromeScale = useCounterScale(1 / DEMO_MIN_ZOOM)

  const experience = useMemo(() => {
    const started = startFromTemplate({ ...EMPTY_JOURNEY, brand, shell: 'modal' }, 'cancel_4')
    return compileJourney({ ...started, steps: withLive(started.steps, true) }).experience
  }, [brand])

  const steps = useMemo(
    () => experience.steps.filter((s) => !s.disabled && !isOutcomeStep(s)),
    [experience.steps],
  )
  const step = steps[Math.min(index, Math.max(0, steps.length - 1))]
  const stage = DEMO_STAGES[Math.min(index, DEMO_STAGES.length - 1)]

  useEffect(() => {
    return () => useEmptyDemoWalk.setState({ index: 0 })
  }, [])

  useEffect(() => {
    if (steps.length === 0) return
    const t = window.setInterval(() => {
      if (hover.current) return
      useEmptyDemoWalk.setState((s) => ({ index: (s.index + 1) % DEMO_STAGES.length }))
    }, 4500)
    return () => window.clearInterval(t)
  }, [steps.length])

  if (!step || !stage) return null

  const confirmation = step.components.find((c) => c.kind === 'confirmation')
  const isOfferStep = step.components.length > 0 && step.components.every((c) => c.kind === 'offer')
  const ctx: RenderCtxValue = {
    mode: 'play',
    interactive: false,
    shell: 'modal',
    device: 'tablet',
    branding: experience.branding,
    session: idleSession(null),
    actions: defaultRenderActions,
    edit: null,
  }

  const last = DEMO_STAGES.length - 1

  return (
    <div
      data-canvas-overlay="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => {
        hover.current = true
      }}
      onMouseLeave={() => {
        hover.current = false
      }}
      className="flex h-full min-h-0 w-full flex-col px-4 pb-2 pt-3"
    >
      <div className="flex-none" style={{ zoom: chromeScale }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Demo screens">
            {DEMO_STAGES.map((s, i) => (
              <button
                key={s.label}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.label}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-5 bg-slate-800' : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {index + 1} of {DEMO_STAGES.length} · {stage.label}
          </div>
        </div>
        <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-slate-800">{stage.caption}</p>
        <p className="mt-1 text-[11.5px] leading-snug text-slate-500">
          This is a demo of the recommended 4-step. Copilot has not started a file yet.
        </p>
      </div>

      <div className="mt-2 flex min-h-0 min-w-0 flex-1 items-center gap-2">
        <SideArrow
          direction="prev"
          disabled={index === 0}
          onClick={() => setIndex(Math.max(0, index - 1))}
        />
        <BrandRoot branding={experience.branding} className="min-h-0 min-w-0 flex-1 self-stretch">
          <DeviceChrome device="tablet" brandName={experience.branding.merchantName}>
            <div className="pointer-events-none">
              <RenderProvider value={ctx}>
                <StepFrame
                  index={index}
                  total={DEMO_STAGES.length}
                  title={step.title}
                  description={step.description}
                  frame={experience.frame}
                  branding={experience.branding}
                  showBack={index > 0}
                  hideTitleBlock={!!confirmation || isOfferStep}
                  centerActions={!!confirmation && DEMO_STAGES.length === 1}
                  actions={<PlayFooter step={step} />}
                >
                  <StepRenderer step={step} />
                </StepFrame>
              </RenderProvider>
            </div>
          </DeviceChrome>
        </BrandRoot>
        <SideArrow
          direction="next"
          onClick={() => setIndex(index === last ? 0 : index + 1)}
        />
      </div>
    </div>
  )
}
