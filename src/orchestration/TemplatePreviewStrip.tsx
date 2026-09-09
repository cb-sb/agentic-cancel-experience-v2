import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react'
import { compileJourney } from '../journey/compile'
import { startFromTemplate, withLive, type LibraryEntry } from '../journey/templates'
import { isOutcomeStep } from '../lib/stepColumns'
import { brandStyle } from '../render/brand'
import {
  RenderProvider,
  defaultRenderActions,
  type RenderCtxValue,
} from '../render/RenderContext'
import { StepFrame } from '../render/StepFrame'
import { StepRenderer } from '../render/StepRenderer'
import { EMPTY_JOURNEY, type JourneyBrand } from '../journey/types'
import type { ConfirmationComponent, Step } from '../types/experience'
import type { PlaySession } from '../store/useExperience'

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

function stripSteps(steps: Step[], templateId: LibraryEntry['id']): Step[] {
  const live = steps.filter((s) => !s.disabled)
  if (templateId === 'cancel_1') return live
  return live.filter((s) => !isOutcomeStep(s))
}

function thumbScale(count: number, acquire: boolean) {
  if (acquire) return 0.4
  if (count <= 2) return 0.48
  if (count === 3) return 0.44
  if (count === 4) return 0.34
  return 0.3
}

function FakeBtn({
  children,
  variant = 'primary',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
}) {
  const styles: Record<typeof variant, CSSProperties> = {
    primary: { background: 'var(--brand-primary)', color: '#fff' },
    secondary: { background: 'var(--brand-secondary)', color: '#fff' },
    outline: {
      background: '#fff',
      color: 'var(--brand-primary)',
      border: '1px solid var(--brand-primary)',
    },
    ghost: { background: 'transparent', color: 'var(--brand-primary)' },
  }
  return (
    <span
      className="inline-flex items-center justify-center text-sm font-semibold"
      style={{
        borderRadius: 'calc(var(--brand-radius) * 0.66)',
        padding: '10px 18px',
        lineHeight: 1.2,
        ...styles[variant],
      }}
    >
      {children}
    </span>
  )
}

function PlayFooter({ step }: { step: Step }) {
  const confirmation = step.components.find((c): c is ConfirmationComponent => c.kind === 'confirmation')
  const isOutcome = step.components.some((c) => c.kind === 'outcome')
  const isCheckout = step.components.some((c) => c.kind === 'checkout')
  const hasOffer = step.components.some((c) => c.kind === 'offer')

  if (isCheckout) return <FakeBtn>Confirm &amp; apply</FakeBtn>
  if (confirmation) {
    return (
      <>
        <FakeBtn variant="outline">{confirmation.keepCta}</FakeBtn>
        <FakeBtn variant="secondary">{confirmation.cancelCta}</FakeBtn>
      </>
    )
  }
  if (isOutcome) return <FakeBtn variant="ghost">Close</FakeBtn>
  const continueLabel = step.navContinueLabel ?? (hasOffer ? 'No thanks, continue cancelling →' : 'Continue')
  return (
    <FakeBtn>
      <span dangerouslySetInnerHTML={{ __html: continueLabel }} />
    </FakeBtn>
  )
}

function FlowChevron({ offset }: { offset: number }) {
  return (
    <span
      className="mx-2.5 flex-none text-slate-400"
      style={{ marginTop: offset }}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M5.5 2.5 11 8l-5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function TemplateStepThumb({
  step,
  index,
  total,
  branding,
  frame,
  label,
  acquire,
  scale,
}: {
  step: Step
  index: number
  total: number
  branding: ReturnType<typeof compileJourney>['experience']['branding']
  frame: ReturnType<typeof compileJourney>['experience']['frame']
  label: string
  acquire: boolean
  scale: number
}) {
  const nativeW = acquire ? 780 : 390
  const nativeH = acquire ? 480 : 500
  const screenW = nativeW * scale
  const screenH = nativeH * scale
  const confirmation = step.components.find((c) => c.kind === 'confirmation')
  const isConfirmation = !!confirmation
  const isOutcome = step.components.some((c) => c.kind === 'outcome')
  const isOfferStep = step.components.length > 0 && step.components.every((c) => c.kind === 'offer')
  const isCheckout = step.components.some((c) => c.kind === 'checkout')
  const outcome = step.components.find((c) => c.kind === 'outcome')
  const result: PlaySession['result'] =
    outcome && outcome.kind === 'outcome' ? outcome.forResult : null

  const ctx: RenderCtxValue = {
    mode: 'play',
    interactive: false,
    shell: acquire ? 'fullpage' : 'modal',
    device: acquire ? 'desktop' : 'mobile',
    branding,
    session: idleSession(result),
    actions: defaultRenderActions,
    edit: null,
  }

  const screen = (
    <div className="overflow-hidden" style={{ width: screenW, height: screenH }}>
      <div
        className="pointer-events-none origin-top-left"
        style={{
          width: nativeW,
          height: nativeH,
          transform: `scale(${scale})`,
          ...brandStyle(branding),
        }}
      >
        <RenderProvider value={ctx}>
          <StepFrame
            index={index}
            total={total}
            title={step.title}
            description={step.description}
            frame={frame}
            branding={branding}
            showBack={index > 0 && !isOutcome}
            hideTitleBlock={isConfirmation || isOutcome || isOfferStep || isCheckout}
            centerActions={(isConfirmation && total === 1) || isOutcome}
            fixedHeight={nativeH}
            actions={<PlayFooter step={step} />}
          >
            <StepRenderer step={step} />
          </StepFrame>
        </RenderProvider>
      </div>
    </div>
  )

  return (
    <div className="flex flex-none flex-col items-center">
      {acquire ? (
        <div
          className="overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_-16px_rgba(15,23,42,0.45)]"
          style={{ width: screenW, boxShadow: '0 18px 40px -16px rgba(15,23,42,0.45), 0 0 0 1px rgba(15,23,42,0.08)' }}
        >
          <div className="flex h-6 items-center gap-1.5 border-b border-slate-200/80 bg-slate-50 px-2.5">
            <span className="h-[7px] w-[7px] rounded-full bg-[#ff5f57]" />
            <span className="h-[7px] w-[7px] rounded-full bg-[#febc2e]" />
            <span className="h-[7px] w-[7px] rounded-full bg-[#28c840]" />
            <span className="ml-1 h-3.5 flex-1 rounded-md bg-white" />
          </div>
          <div className="overflow-hidden bg-white">{screen}</div>
        </div>
      ) : (
        <div
          className="rounded-[20px] bg-slate-800 p-[5px]"
          style={{
            width: screenW + 10,
            boxShadow: '0 18px 40px -16px rgba(15,23,42,0.5), 0 0 0 1px rgba(15,23,42,0.16)',
          }}
        >
          <div className="overflow-hidden rounded-[15px] bg-white">{screen}</div>
        </div>
      )}
      <span className="mt-2.5 max-w-full truncate px-0.5 text-[11px] font-semibold text-slate-600">
        {label}
      </span>
    </div>
  )
}

/** Glanceable subscriber screens for one library card, tinted with the live merchant brand. */
export function TemplatePreviewStrip({
  entry,
  brand,
}: {
  entry: LibraryEntry
  brand: JourneyBrand
}) {
  const acquire = entry.kind === 'acquisition'
  const experience = useMemo(() => {
    const started = startFromTemplate(
      { ...EMPTY_JOURNEY, brand, shell: acquire ? 'fullpage' : 'modal' },
      entry.id,
    )
    return compileJourney({ ...started, steps: withLive(started.steps, true) }).experience
  }, [entry.id, brand.merchant, brand.primary, brand.corners, acquire])

  const steps = stripSteps(experience.steps, entry.id)
  const scale = thumbScale(steps.length, acquire)
  const nativeH = acquire ? 480 : 500
  const tint = `${experience.branding.primaryColor}14`
  const chevronOffset = (nativeH * scale) / 2 - 9

  return (
    <div
      aria-hidden
      className="pointer-events-none relative overflow-hidden"
      style={{
        backgroundColor: '#eef2f6',
        backgroundImage: `linear-gradient(180deg, ${tint}, transparent 70%), radial-gradient(#c5cdd8 1.15px, transparent 1.15px)`,
        backgroundSize: 'auto, 18px 18px',
      }}
    >
      <div className="flex items-start justify-center overflow-x-auto px-7 py-7">
        {steps.map((step, i) => (
          <Fragment key={step.id}>
            {i > 0 && <FlowChevron offset={chevronOffset} />}
            <TemplateStepThumb
              step={step}
              index={i}
              total={entry.stepCount}
              branding={experience.branding}
              frame={experience.frame}
              label={entry.stepLabels[i] ?? step.title}
              acquire={acquire}
              scale={scale}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}
