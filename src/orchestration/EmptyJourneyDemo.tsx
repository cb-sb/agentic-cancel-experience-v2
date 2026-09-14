import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { compileJourney } from '../journey/compile'
import { startFromTemplate, withLive } from '../journey/templates'
import { isOutcomeStep } from '../lib/stepColumns'
import { BrandButton, BrandRoot } from '../render/BrandUI'
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
import { useOrchestration } from '../store/useOrchestration'
import { useUpload } from '../upload/useUpload'
import { DEMO_OUTCOME_CRUMB, DEMO_STAGES, useEmptyDemoWalk } from './emptyDemoFlag'
import glowUrl from './assets/demo-tablet-glow.svg'
import arrowPrevUrl from './assets/demo-arrow-prev.svg'
import arrowNextUrl from './assets/demo-arrow-next.svg'

/** Figma 292:256 — white card, landscape tablet, arrows on the edges. */
const CARD_W = 1488
const CARD_H = 602
const TABLET_W = 624
const TABLET_H = 480
const TABLET_BEZEL = 12
const SCREEN_PAD = 16
const TABLET_SCREEN_W = TABLET_W - TABLET_BEZEL * 2
const TABLET_SCREEN_H = TABLET_H - TABLET_BEZEL * 2
/** Same card on every step — no per-step scale, no jumping proportions. */
const MODAL_W = 440
const MODAL_H = 400
/** Outer box of the exported arrow SVG (circle 53px + drop shadow). */
const ARROW_ASSET = 81

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
  const compactBtn = { fontSize: 12, padding: '8px 12px' } as const
  const confirmation = step.components.find((c): c is ConfirmationComponent => c.kind === 'confirmation')
  const hasOffer = step.components.some((c) => c.kind === 'offer')
  if (confirmation) {
    return (
      <>
        <BrandButton variant="outline" type="button" tabIndex={-1} style={compactBtn}>
          {confirmation.keepCta}
        </BrandButton>
        <BrandButton variant="secondary" type="button" tabIndex={-1} style={compactBtn}>
          {confirmation.cancelCta}
        </BrandButton>
      </>
    )
  }
  const continueLabel = step.navContinueLabel ?? (hasOffer ? 'No thanks, continue cancelling →' : 'Continue')
  return (
    <BrandButton type="button" tabIndex={-1} style={compactBtn}>
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
      className="absolute top-1/2 z-20 -translate-y-1/2 disabled:pointer-events-none disabled:opacity-40"
      style={{
        width: ARROW_ASSET,
        height: ARROW_ASSET,
        left: prev ? -ARROW_ASSET / 2 : undefined,
        right: prev ? undefined : -ARROW_ASSET / 2,
      }}
    >
      <img
        alt=""
        src={prev ? arrowPrevUrl : arrowNextUrl}
        width={ARROW_ASSET}
        height={ARROW_ASSET}
        className="pointer-events-none block max-w-none"
        aria-hidden
      />
    </button>
  )
}

function ProgressPips({ index, total, onPick }: { index: number; total: number; onPick: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Demo screens">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="flex h-2 w-8 items-center">
          <button
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Step ${i + 1}`}
            onClick={() => onPick(i)}
            className={`h-2 rounded-full ${
              i === index ? 'w-8 bg-[#ff3300]' : i < index ? 'w-4 bg-[#ff3300]/50' : 'w-2 bg-slate-200 hover:bg-slate-300'
            }`}
          />
        </span>
      ))}
    </div>
  )
}

function FlowNavBar({
  index,
  onPick,
  onUse,
  onGuide,
}: {
  index: number
  onPick: (i: number) => void
  onUse: () => void
  onGuide: () => void
}) {
  return (
    <div className="flex h-10 w-max flex-none items-center gap-3 rounded-full border border-slate-200/70 bg-white/80 px-2 pl-1.5">
      <span className="flex h-6 items-center rounded-full bg-[#012a38] px-2.5 text-[12px] font-semibold text-[#effeff]">
        Demo
      </span>
      <div className="flex items-center gap-2">
        {DEMO_STAGES.map((stage, i) => (
          <span key={stage.crumb} className="flex items-center gap-2">
            {i > 0 && <span className="text-[12px] font-normal text-slate-300">→</span>}
            <button
              type="button"
              onClick={() => onPick(i)}
              className={`whitespace-nowrap text-[13px] font-medium ${
                i === index ? 'text-[#ff3300]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {stage.crumb}
            </button>
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="text-[12px] font-normal text-slate-300">→</span>
          <span className="whitespace-nowrap text-[13px] font-medium text-slate-400">{DEMO_OUTCOME_CRUMB}</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onGuide}
          className="whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        >
          Help me choose
        </button>
        <button
          type="button"
          onClick={onUse}
          className="whitespace-nowrap rounded-full bg-[#2563eb] px-3 py-1 text-[13px] font-medium text-white hover:bg-[#1d4ed8]"
        >
          Use this flow →
        </button>
      </div>
    </div>
  )
}

/**
 * Canned subscriber walk of cancel_4, previewed in a landscape tablet.
 * Compiles in memory — does not write the journey file until the merchant uses
 * Copilot or “Use this flow”. The tablet chrome is a fixed box so switching
 * screens cannot jump the frame.
 */
export function EmptyJourneyDemo() {
  const brand = useJourney((s) => s.file.brand)
  const index = useEmptyDemoWalk((s) => s.index)
  const setIndex = useEmptyDemoWalk((s) => s.setIndex)
  const applyLibraryTemplate = useOrchestration((s) => s.applyLibraryTemplate)
  const requestCopilotGuide = useOrchestration((s) => s.requestCopilotGuide)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const openUpload = useUpload((s) => s.open)
  const hover = useRef(false)
  const [dir, setDir] = useState(1)

  const goTo = (next: number) => {
    const cur = useEmptyDemoWalk.getState().index
    const n = DEMO_STAGES.length
    const wrappedFwd = cur === n - 1 && next === 0
    const wrappedBack = cur === 0 && next === n - 1
    setDir(wrappedFwd ? 1 : wrappedBack ? -1 : next >= cur ? 1 : -1)
    setIndex(next)
  }

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
      setDir(1)
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
      className="flex h-full w-full flex-col items-center"
    >
      <FlowNavBar
        index={index}
        onPick={goTo}
        onUse={() => applyLibraryTemplate('cancel_4')}
        onGuide={() => requestCopilotGuide()}
      />

      <div className="relative mt-4 flex-none" style={{ width: CARD_W, height: CARD_H }}>
        <SideArrow
          direction="prev"
          disabled={index === 0}
          onClick={() => goTo(Math.max(0, index - 1))}
        />
        <div
          className="flex h-full w-full items-center overflow-hidden rounded-[60px] bg-white shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
          style={{ paddingLeft: 120, paddingRight: 80 }}
        >
          <div className="flex h-full w-[504px] flex-none flex-col justify-center">
            <p className="h-4 text-[12px] font-semibold uppercase leading-4 text-[#ff3300]">
              Step {index + 1} of {DEMO_STAGES.length}: {stage.label}
            </p>
            <div className="mt-2.5 h-2">
              <ProgressPips index={index} total={DEMO_STAGES.length} onPick={goTo} />
            </div>
            <h3
              key={`caption-${stage.label}`}
              className="demo-copy-in mt-4 min-h-[110px] text-[24px] font-bold leading-[1.15] text-slate-500"
            >
              {stage.caption}
            </h3>
            <p
              key={`body-${stage.label}`}
              className="demo-copy-in mt-4 min-h-[116px] text-[18px] font-normal leading-[1.6] text-slate-600"
            >
              {stage.body}
            </p>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="relative flex-none" style={{ width: TABLET_W, height: TABLET_H }}>
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: 500, height: 500 }}
              >
                <img
                  alt=""
                  src={glowUrl}
                  aria-hidden
                  className="absolute -inset-[20%] h-[140%] w-[140%] max-w-none"
                />
              </div>
              <div
                className="relative overflow-hidden"
                style={{
                  width: TABLET_W,
                  height: TABLET_H,
                  padding: TABLET_BEZEL,
                  borderRadius: 32,
                  background: '#1e293b',
                  boxShadow: '0 24px 24px rgba(15,23,42,0.15)',
                }}
              >
                <div
                  className="flex items-center justify-center overflow-hidden"
                  style={{
                    width: TABLET_SCREEN_W,
                    height: TABLET_SCREEN_H,
                    borderRadius: 22,
                    background: 'linear-gradient(180deg, #f1f5f9 8.23%, #ff3300 147.41%)',
                    padding: SCREEN_PAD,
                  }}
                >
                  <div
                    key={step.id}
                    className="demo-step-in demo-ipad-modal flex-none"
                    style={
                      {
                        width: MODAL_W,
                        height: MODAL_H,
                        '--demo-dx': dir > 0 ? '22px' : '-22px',
                      } as CSSProperties
                    }
                  >
                    <BrandRoot
                      branding={experience.branding}
                      className="pointer-events-none h-full w-full"
                    >
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
                          compact
                          fixedHeight={MODAL_H}
                          actions={<PlayFooter step={step} />}
                        >
                          <StepRenderer step={step} />
                        </StepFrame>
                      </RenderProvider>
                    </BrandRoot>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <SideArrow
          direction="next"
          onClick={() => goTo(index === last ? 0 : index + 1)}
        />
      </div>

      <div className="mt-7 flex items-start gap-8">
        <p className="w-[301px] text-[14px] font-medium leading-[1.6] text-slate-600">
          If you don’t like what you see you can upload your own static files and we’ll make sense of it.
          Alternatively, you can browse from our prebuilt templates.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={openUpload}
            className="text-left text-[15px] font-semibold text-[#2563eb] underline decoration-solid underline-offset-2 hover:text-[#1d4ed8]"
          >
            Upload my own template →
          </button>
          <button
            type="button"
            onClick={() => openTemplates()}
            className="text-left text-[15px] font-semibold text-[#2563eb] underline decoration-solid underline-offset-2 hover:text-[#1d4ed8]"
          >
            Browse template library →
          </button>
        </div>
      </div>
    </div>
  )
}
