import { Fragment, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { compileJourney } from '../journey/compile'
import { startFromTemplate, withLive, type LibraryEntry } from '../journey/templates'
import { isOutcomeStep } from '../lib/stepColumns'
import { StepOutline } from './flow/tiers/StepOutline'
import { BrandRoot } from '../render/BrandUI'
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

function thumbScale(count: number, acquire: boolean, compact?: boolean) {
  const base = acquire ? 0.46 : count <= 2 ? 0.56 : count === 3 ? 0.52 : count === 4 ? 0.42 : 0.38
  return compact ? base * 0.84 : base
}

function FakeBtn({
  children,
  variant = 'primary',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
}) {
  const styles: Record<typeof variant, CSSProperties> = {
    primary: {
      background: 'var(--brand-btn-fill, var(--brand-primary))',
      color: 'var(--brand-btn-text, #fff)',
      clipPath: 'var(--brand-btn-clip, none)',
      borderRadius: 'var(--brand-btn-radius)',
    },
    secondary: { background: 'var(--brand-secondary)', color: '#fff' },
    outline: {
      background: 'var(--brand-card-solid, #fff)',
      color: 'var(--brand-title, var(--brand-primary))',
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
  const hasPricing = step.components.some((c) => c.kind === 'pricing_table')

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
  const continueLabel =
    step.navContinueLabel ?? (hasOffer || hasPricing ? 'No thanks, continue cancelling →' : 'Continue')
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

export function TemplateStepThumb({
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
  label?: string
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
      <BrandRoot
        branding={branding}
        className="pointer-events-none origin-top-left"
        style={{
          width: nativeW,
          height: nativeH,
          transform: `scale(${scale})`,
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
      </BrandRoot>
    </div>
  )

  return (
    <div className="flex flex-none flex-col items-center">
      {label && (
        <span className="mb-2.5 max-w-full truncate px-0.5 text-[11px] font-semibold text-slate-600">
          {label}
        </span>
      )}
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
    </div>
  )
}

function useTemplateSteps(entry: LibraryEntry, brand: JourneyBrand) {
  const acquire = entry.kind === 'acquisition'
  const experience = useMemo(() => {
    const started = startFromTemplate(
      { ...EMPTY_JOURNEY, brand, shell: acquire ? 'fullpage' : 'modal' },
      entry.id,
    )
    return compileJourney({ ...started, steps: withLive(started.steps, true) }).experience
  }, [entry.id, brand.merchant, brand.primary, brand.corners, acquire])
  return { acquire, experience, steps: stripSteps(experience.steps, entry.id) }
}

/** What each template screen is, and why it is in the flow. Keyed by template step id. */
function stepPurpose(stepId: string, acquire: boolean): string {
  switch (stepId) {
    case 'value':
      return 'Lists what they lose by leaving, like credits and saved work. Seeing it is often enough to make them stay.'
    case 'entry':
      return 'Makes an offer before any questions, like a free month. It catches people who are on the fence.'
    case 'survey':
      return 'Asks why they are leaving. Their answers show you what to fix.'
    case 'offer':
      return 'Makes one offer to stay, such as a discount. It comes after they say why, so it answers their reason.'
    case 'pricing':
      return acquire
        ? 'Shows your plans side by side so a new subscriber can pick one.'
        : 'Shows cheaper plans they can move to, so they stay at a lower price.'
    case 'checkout':
      return acquire
        ? 'Takes payment in hosted checkout. The subscription starts when they pay.'
        : 'Takes payment for the new plan in hosted checkout.'
    case 'confirm':
      return 'Asks them to confirm the cancel. Every cancel experience has this screen.'
    case 'saved':
      return 'Shown when they choose to stay.'
    case 'cancelled':
      return 'Shown after they cancel, with a way to undo it.'
    default:
      return ''
  }
}

const OUTLINE_W = 184
const OUTLINE_H = 124

/**
 * Low-fidelity screens for a library card. The strip is one target: it hovers
 * as a set, and a click opens every screen at full size, centred on the one clicked.
 */
export function TemplateOutlineStrip({
  entry,
  brand,
  onOpen,
  className,
}: {
  entry: LibraryEntry
  brand: JourneyBrand
  onOpen: (index: number) => void
  className?: string
}) {
  const { steps } = useTemplateSteps(entry, brand)
  return (
    <ol
      role="button"
      tabIndex={0}
      aria-label={`See the ${entry.title} screens full size`}
      title="See the screens full size"
      onClick={(e) => {
        const at = (e.target as HTMLElement).closest<HTMLElement>('[data-step]')
        onOpen(at ? Number(at.dataset.step) : 0)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onOpen(0)
      }}
      className={`group/strip flex cursor-pointer items-start overflow-x-auto px-[18px] pb-[20px] pt-[18px] outline-none transition-[background-color] duration-200 hover:!bg-[#e6ebf2] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${className ?? ''}`}
      style={{
        backgroundColor: '#eef2f6',
        backgroundImage: 'radial-gradient(#d5dde8 1px, transparent 1px)',
        backgroundSize: '12px 12px',
      }}
    >
      {steps.map((step, i) => {
        const label = entry.stepLabels[i] ?? step.title
        return (
          <Fragment key={step.id}>
            {i > 0 && (
              <li
                aria-hidden
                className="flex w-[30px] flex-none items-center justify-center text-slate-400 transition-colors duration-200 group-hover/strip:text-indigo-400"
                style={{ height: OUTLINE_H }}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M5.5 2.5 11 8l-5.5 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </li>
            )}
            <li data-step={i} className="flex flex-none flex-col items-center" style={{ width: OUTLINE_W }}>
              <span
                className="block rounded-[12px] shadow-[0_0_0_1px_rgba(148,163,184,0.55),0_2px_4px_rgba(15,23,42,0.06),0_10px_22px_-10px_rgba(15,23,42,0.28)] transition-[box-shadow,transform] duration-200 ease-out group-hover/strip:-translate-y-[3px] group-hover/strip:shadow-[0_0_0_2px_#a5b4fc,0_16px_32px_-14px_rgba(15,23,42,0.38)]"
                data-morph-screen={i}
                style={{ width: OUTLINE_W, height: OUTLINE_H }}
              >
                <span className="block h-full w-full overflow-hidden rounded-[12px] [&>div]:border-slate-300 [&>div]:bg-white">
                  <StepOutline step={step} w={OUTLINE_W} h={OUTLINE_H} selected={false} density="strip" />
                </span>
              </span>
              <span
                className="mt-[10px] flex w-full items-center justify-center gap-[6px] px-[2px] text-[13px] font-semibold leading-[18px] text-slate-800 transition-colors duration-200 group-hover/strip:text-indigo-700"
              >
                <span className="flex items-center gap-[6px]" data-morph-label={i}>
                  <span className="tabular-nums text-[12px] text-slate-400">{i + 1}</span>
                  <span className="min-w-0 truncate">{label}</span>
                </span>
              </span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}

/** Full-size subscriber screens for the template confirm view, each with what it is and why it is there. */
export function TemplateScreens({
  entry,
  brand,
  focus = 0,
}: {
  entry: LibraryEntry
  brand: JourneyBrand
  focus?: number
}) {
  const { acquire, experience, steps } = useTemplateSteps(entry, brand)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const scale = acquire ? 0.62 : 0.78
  const width = (acquire ? 780 : 390) * scale + (acquire ? 0 : 10)

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const item = itemRefs.current[focus]
    if (!scroller || !item || focus === 0) return
    scroller.scrollLeft = item.offsetLeft - (scroller.clientWidth - item.offsetWidth) / 2
  }, [focus])

  return (
    <div
      ref={scrollerRef}
      className="overflow-x-auto"
      style={{
        backgroundColor: '#f8fafc',
        backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
        backgroundSize: '12px 12px',
      }}
    >
      <ol className="flex w-max min-w-full items-start justify-center px-[24px] pb-[28px] pt-[24px]">
        {steps.map((step, i) => (
          <Fragment key={step.id}>
            {i > 0 && (
              <li aria-hidden data-morph-fade className="flex flex-none">
                <FlowChevron offset={(acquire ? 480 * scale + 24 : 500 * scale + 10) / 2 - 9} />
              </li>
            )}
            <li
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              className="flex flex-none flex-col"
              style={{ width }}
            >
              <div
                aria-hidden
                className={`rounded-[22px] ${i === focus && focus > 0 ? 'ring-2 ring-indigo-400 ring-offset-4 ring-offset-[#f8fafc]' : ''}`}
                data-morph-screen={i}
              >
                <TemplateStepThumb
                  step={step}
                  index={i}
                  total={entry.stepCount}
                  branding={experience.branding}
                  frame={experience.frame}
                  acquire={acquire}
                  scale={scale}
                />
              </div>
              <div className="mt-[16px] px-[4px]">
                <p className="flex items-baseline gap-[6px] text-[14px] font-semibold leading-[20px] text-slate-900">
                  <span className="flex w-fit items-baseline gap-[6px]" data-morph-label={i}>
                    <span className="tabular-nums text-[12px] text-slate-400">{i + 1}</span>
                    {entry.stepLabels[i] ?? step.title}
                  </span>
                </p>
                <p data-morph-fade className="mt-[4px] text-[13px] leading-[20px] text-slate-600">
                  {stepPurpose(step.id, acquire)}
                </p>
              </div>
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  )
}

/** Glanceable subscriber screens for one library card, tinted with the live merchant brand. */
export function TemplatePreviewStrip({
  entry,
  brand,
  compact,
}: {
  entry: LibraryEntry
  brand: JourneyBrand
  compact?: boolean
}) {
  const { acquire, experience, steps } = useTemplateSteps(entry, brand)
  const scale = thumbScale(steps.length, acquire, compact)
  const nativeH = acquire ? 480 : 500
  const tint = `${experience.branding.primaryColor}14`
  const labelBlock = 28
  const chevronOffset = labelBlock + (nativeH * scale) / 2 - 9

  return (
    <div
      aria-hidden
      className="relative overflow-x-auto"
      style={{
        backgroundColor: '#f5f7fa',
        backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${tint} 46%, #f2f4f8 100%), radial-gradient(rgba(148,163,184,0.35) 1.05px, transparent 1.05px)`,
        backgroundSize: 'auto, 18px 18px',
      }}
    >
      <div
        className={`pointer-events-none flex w-max min-w-full items-start justify-center ${
          compact ? 'px-[16px] pb-[18px] pt-[6px]' : 'px-8 pb-9 pt-3'
        }`}
      >
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
