import { useLayoutEffect, useRef, useState } from 'react'
import { useExperience } from '../store/useExperience'
import { BrandRoot } from '../render/BrandUI'
import { RenderProvider, defaultRenderActions, type RenderCtxValue } from '../render/RenderContext'
import { StepFrame } from '../render/StepFrame'
import { StepRenderer } from '../render/StepRenderer'
import { DEVICE_WIDTHS } from '../render/DeviceFrame'
import { DeviceChrome, FittedDevice, PageBehind } from '../render/DeviceChrome'
import { DeviceToggle } from '../render/DeviceToggle'
import { EditableCTA } from '../render/Editable'
import { StepTabs } from './StepTabs'
import type { PlaySession, DeviceKind } from '../store/useExperience'
import type { Step } from '../types/experience'

function previewSession(): PlaySession {
  return {
    index: 0,
    selectedReasonId: null,
    reasonText: {},
    acceptedOfferId: null,
    checkout: { open: false, offerId: null },
    result: null,
    undone: false,
    confirmInput: '',
    consentChecked: false,
    feedback: '',
  }
}

/** Extra page shown around the modal so the branded page behind stays visible. */
const MODAL_PAGE_PAD = 44

export function ComposerPreview() {
  const experience = useExperience((s) => s.experience)
  const activeStepId = useExperience((s) => s.activeStepId)
  const device = useExperience((s) => s.device)
  const updateStep = useExperience((s) => s.updateStep)
  const updateComponent = useExperience((s) => s.updateComponent)

  const steps = experience.steps
  const index = Math.max(0, steps.findIndex((s) => s.id === activeStepId))
  const step = steps[index] ?? steps[0]
  const isFullPage = experience.shell !== 'modal'

  const ctx: RenderCtxValue = {
    mode: 'compose',
    interactive: false,
    shell: experience.shell,
    device,
    branding: experience.branding,
    session: previewSession(),
    actions: defaultRenderActions,
    edit: {
      updateStep: (patch) => updateStep(step.id, patch),
      updateComponent: (componentId, patch) => updateComponent(step.id, componentId, patch),
    },
  }

  // Footer differs per step: confirmation shows Keep/Cancel, others a Continue.
  const footerFor = (s: Step) => {
    const confirmation = s.components.find((c) => c.kind === 'confirmation')
    if (confirmation && confirmation.kind === 'confirmation') {
      return (
        <>
          <EditableCTA
            label={confirmation.keepCta}
            onCommit={(v) => updateComponent(s.id, confirmation.id, { keepCta: v })}
            className="text-sm font-semibold"
            style={{
              color: 'var(--brand-primary)',
              background: '#fff',
              borderRadius: 'calc(var(--brand-radius) * 0.66)',
              padding: '9px 18px',
            }}
          />
          <EditableCTA
            label={confirmation.cancelCta}
            onCommit={(v) => updateComponent(s.id, confirmation.id, { cancelCta: v })}
            className="text-sm font-semibold text-white"
            style={{
              background: '#0f172a',
              borderRadius: 'calc(var(--brand-radius) * 0.66)',
              padding: '9px 18px',
            }}
          />
        </>
      )
    }
    // The outcome step is terminal — it closes the flow rather than continuing.
    if (s.components.some((c) => c.kind === 'outcome')) {
      return (
        <span
          className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500"
          style={{ background: 'rgba(15,23,42,0.05)' }}
        >
          Close
        </span>
      )
    }
    const hasOffer = s.components.some((c) => c.kind === 'offer')
    const defaultContinue = hasOffer ? 'No thanks, continue cancelling →' : 'Continue'
    return (
      <EditableCTA
        label={s.navContinueLabel ?? defaultContinue}
        onCommit={(v) => updateStep(s.id, { navContinueLabel: v })}
        className="text-sm font-semibold text-white"
        style={{
          background: 'var(--brand-primary)',
          borderRadius: 'calc(var(--brand-radius) * 0.66)',
          padding: '10px 18px',
        }}
      />
    )
  }

  const stepFrameFor = (s: Step, i: number, fixedHeight?: number) => {
    const isConfirmation = s.components.some((c) => c.kind === 'confirmation')
    const isOutcome = s.components.some((c) => c.kind === 'outcome')
    const isOfferStep = s.components.length > 0 && s.components.every((c) => c.kind === 'offer')
    const isLaStep = s.stage === 'value_reinforcement'
    return (
      <StepFrame
        index={i}
        total={steps.length}
        title={s.title}
        description={s.description}
        frame={experience.frame}
        branding={experience.branding}
        showBack={i > 0}
        hideTitleBlock={isConfirmation || isOutcome || isOfferStep}
        centerActions={(isConfirmation && steps.length === 1) || isOutcome}
        fixedHeight={fixedHeight}
        titleMaxWords={isLaStep ? 10 : undefined}
        titleMaxChars={isLaStep ? 72 : undefined}
        descriptionMaxChars={isLaStep ? 120 : undefined}
        actions={footerFor(s)}
      >
        <StepRenderer step={s} />
      </StepFrame>
    )
  }

  // Full-page shells preview inside the realistic device chrome so the canvas
  // matches a full-screen monitor (desktop) / iPad / phone aspect ratio rather
  // than the narrow modal frame. Modal keeps its floating-card frame.
  if (isFullPage) {
    return (
      <div className="flex h-full flex-col items-center gap-4 p-6">
        <RenderProvider value={ctx}>
          <div className="flex flex-none items-center gap-3">
            <DeviceToggle />
          </div>
          <div className="flex-none">
            <StepTabs />
          </div>
          <div className="min-h-0 w-full flex-1">
            <BrandRoot branding={experience.branding} className="h-full">
              <DeviceChrome device={device} brandName={experience.branding.merchantName} fullBleed bare>
                {stepFrameFor(step, index)}
              </DeviceChrome>
            </BrandRoot>
          </div>
        </RenderProvider>
      </div>
    )
  }

  return <ModalPreview
    ctx={ctx}
    steps={steps}
    step={step}
    index={index}
    device={device}
    branding={experience.branding}
    stepFrameFor={stepFrameFor}
  />
}

interface ModalPreviewProps {
  ctx: RenderCtxValue
  steps: Step[]
  step: Step
  index: number
  device: DeviceKind
  branding: RenderCtxValue['branding']
  stepFrameFor: (s: Step, i: number, fixedHeight?: number) => JSX.Element
}

/**
 * Modal preview: the card floats on a visible branded page (dim scrim + faint
 * page mock) so it reads as an overlay, never hiding the page. Every step is
 * measured off-screen; the surrounding page frame is pinned to the *tallest*
 * step (so the page never rescales and its margins stay visible), while the
 * card itself resizes to the *current* step's height with an animated
 * transition — a gentle grow/shrink instead of an abrupt jump. Width is fixed
 * per device.
 */
function ModalPreview({ ctx, steps, step, index, device, branding, stepFrameFor }: ModalPreviewProps) {
  const cardWidth = DEVICE_WIDTHS[device]
  const measureRefs = useRef<Array<HTMLDivElement | null>>([])
  const [heights, setHeights] = useState<number[]>([])

  useLayoutEffect(() => {
    const next = measureRefs.current.slice(0, steps.length).map((el) => (el ? el.offsetHeight : 0))
    setHeights((prev) =>
      prev.length === next.length && prev.every((h, i) => Math.abs(h - next[i]) <= 1) ? prev : next,
    )
  })

  const maxHeight = heights.length ? Math.max(...heights) : 0
  const activeHeight = heights[index] || 0
  // Page frame stays a constant size so its scrim/margins never shift.
  const frameHeight = (maxHeight || 620) + MODAL_PAGE_PAD * 2

  return (
    <div className="flex h-full flex-col items-center gap-5 p-6">
      <RenderProvider value={ctx}>
        <div className="flex flex-none items-center gap-3">
          <DeviceToggle />
        </div>
        <div className="flex-none">
          <StepTabs />
        </div>
        <div className="min-h-0 w-full flex-1">
          <BrandRoot branding={branding} className="h-full">
          <FittedDevice>
            <div
              className="relative flex items-center justify-center overflow-hidden rounded-[26px] bg-slate-100 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)] ring-1 ring-black/10"
              style={{ width: cardWidth + MODAL_PAGE_PAD * 2, height: frameHeight }}
            >
              <PageBehind />
              <div className="relative" style={{ width: cardWidth }}>
                {stepFrameFor(step, index, activeHeight || undefined)}
              </div>
            </div>
          </FittedDevice>
          </BrandRoot>
        </div>
      </RenderProvider>

      {/* Off-screen measurer: render every step at the modal width to find the
          tallest so the visible card can pin to that height without jumping. */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-[-99999px] top-0"
        style={{ width: cardWidth, visibility: 'hidden' }}
      >
        <RenderProvider value={ctx}>
          <BrandRoot branding={branding}>
            {steps.map((s, i) => (
              <div
                key={s.id}
                ref={(el) => {
                  measureRefs.current[i] = el
                }}
                style={{ width: cardWidth }}
              >
                {stepFrameFor(s, i)}
              </div>
            ))}
          </BrandRoot>
        </RenderProvider>
      </div>
    </div>
  )
}
