import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { brandStyle } from '../render/brand'
import { RenderProvider, defaultRenderActions, type MappingInfo, type RenderCtxValue } from '../render/RenderContext'
import { StepFrame } from '../render/StepFrame'
import { StepRenderer } from '../render/StepRenderer'
import { EditableCTA } from '../render/Editable'
import { colorForOfferFactory, linkableOffers, offerStepIndex, reasonsByOffer } from '../lib/mapping'
import type { PlaySession } from '../store/useExperience'
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

/**
 * A single cancel-experience step rendered as a modal card directly on the
 * infinite canvas. Compose-mode inline editing is fully live (same render path
 * as the old composer preview), but there are no tabs — every step is its own
 * card in the horizontal flow.
 */
export function CanvasStep({
  step,
  index,
  total,
  width,
  experienceId,
}: {
  step: Step
  index: number
  total: number
  width: number
  experienceId: string
}) {
  const experience = useExperience((s) => s.experiences[experienceId] ?? s.experience)
  const device = useExperience((s) => s.device)
  const updateStep = useExperience((s) => s.updateStep)
  const updateComponent = useExperience((s) => s.updateComponent)
  const focusStep = useOrchestration((s) => s.focusStep)

  // Reason↔offer mapping context — colors/badges/links stay consistent with the
  // connector overlay drawn on the canvas.
  const colorForOffer = colorForOfferFactory(experience)
  const offerSteps = offerStepIndex(experience)
  const mapping: MappingInfo = {
    experienceId: experience.id,
    linkableOffers: linkableOffers(experience).map((o) => ({ ...o, color: colorForOffer(o.id) })),
    reasonsByOffer: reasonsByOffer(experience),
    colorForOffer,
    configureOffer: (offerId) =>
      focusStep({ experienceId: experience.id, stepId: offerSteps.get(offerId) ?? step.id }),
  }

  const ctx: RenderCtxValue = {
    mode: 'compose',
    interactive: false,
    shell: 'modal',
    device,
    branding: experience.branding,
    session: previewSession(),
    actions: defaultRenderActions,
    edit: {
      updateStep: (patch) => updateStep(step.id, patch),
      updateComponent: (componentId, patch) => updateComponent(step.id, componentId, patch),
    },
    mapping,
  }

  const confirmation = step.components.find((c) => c.kind === 'confirmation')
  const isConfirmation = !!confirmation
  const isOutcome = step.components.some((c) => c.kind === 'outcome')
  const isCheckout = step.components.some((c) => c.kind === 'checkout')
  const isOfferStep = step.components.length > 0 && step.components.every((c) => c.kind === 'offer')
  const isLaStep = step.stage === 'value_reinforcement'

  let actions
  if (confirmation && confirmation.kind === 'confirmation') {
    actions = (
      <>
        <EditableCTA
          label={confirmation.keepCta}
          onCommit={(v) => updateComponent(step.id, confirmation.id, { keepCta: v })}
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
          onCommit={(v) => updateComponent(step.id, confirmation.id, { cancelCta: v })}
          className="text-sm font-semibold text-white"
          style={{
            background: '#0f172a',
            borderRadius: 'calc(var(--brand-radius) * 0.66)',
            padding: '9px 18px',
          }}
        />
      </>
    )
  } else if (isCheckout) {
    actions = (
      <span
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
        style={{
          background: 'var(--brand-primary)',
          borderRadius: 'calc(var(--brand-radius) * 0.66)',
          padding: '10px 18px',
        }}
      >
        Confirm &amp; apply
      </span>
    )
  } else if (isOutcome) {
    actions = (
      <span
        className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500"
        style={{ background: 'rgba(15,23,42,0.05)' }}
      >
        Close
      </span>
    )
  } else {
    const hasOffer = step.components.some((c) => c.kind === 'offer')
    const defaultContinue = hasOffer ? 'No thanks, continue cancelling →' : 'Continue'
    actions = (
      <EditableCTA
        label={step.navContinueLabel ?? defaultContinue}
        onCommit={(v) => updateStep(step.id, { navContinueLabel: v })}
        className="text-sm font-semibold text-white"
        style={{
          background: 'var(--brand-primary)',
          borderRadius: 'calc(var(--brand-radius) * 0.66)',
          padding: '10px 18px',
        }}
      />
    )
  }

  return (
    <RenderProvider value={ctx}>
      <div style={{ width, ...brandStyle(experience.branding) }}>
        <StepFrame
          index={index}
          total={total}
          title={step.title}
          description={step.description}
          frame={experience.frame}
          branding={experience.branding}
          showBack={index > 0}
          hideTitleBlock={isConfirmation || isOutcome || isOfferStep || isCheckout}
          centerActions={(isConfirmation && total === 1) || isOutcome}
          titleMaxWords={isLaStep ? 10 : undefined}
          titleMaxChars={isLaStep ? 72 : undefined}
          descriptionMaxChars={isLaStep ? 120 : undefined}
          actions={actions}
        >
          <StepRenderer step={step} />
        </StepFrame>
      </div>
    </RenderProvider>
  )
}
