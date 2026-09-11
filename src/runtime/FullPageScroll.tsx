import { useExperience } from '../store/useExperience'
import { StepFrame } from '../render/StepFrame'
import { StepRenderer } from '../render/StepRenderer'
import { BrandButton } from '../render/BrandUI'
import type { Step } from '../types/experience'

/**
 * Full-page "vertical scroll" shell as a slide deck: every step is a full
 * viewport section, but only one is visible at a time. Clicking Continue /
 * Back slides the deck vertically to the adjacent section (via a transform,
 * so the deck is NOT freely scrollable) — the user can only advance through
 * the nav actions, and gating (e.g. survey) blocks the first section until
 * they proceed. The confirmation step keeps its Keep/Cancel actions, which
 * resolve to the outcome surface (handled by PlayerShell).
 */
export function FullPageScroll() {
  const experience = useExperience((s) => s.experience)
  const session = useExperience((s) => s.session)
  const store = useExperience()
  const steps = experience.steps
  const total = steps.length
  const index = Math.min(session.index, total - 1)

  const goTo = (i: number) => store.goToIndex(Math.max(0, Math.min(i, total - 1)))

  const stepSurveyReady = (step: Step): boolean => {
    const survey = step.components.find((c) => c.kind === 'survey')
    if (!survey || survey.kind !== 'survey') return true
    if (survey.presentation === 'free_text') {
      return (session.reasonText['free'] ?? '').trim().length > 0
    }
    return !!session.selectedReasonId
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {steps.map((step, i) => {
        const confirmation = step.components.find((c) => c.kind === 'confirmation')
        const isConfirmation = !!confirmation
        const isOutcome = step.components.some((c) => c.kind === 'outcome')
        const hasOffer = step.components.some((c) => c.kind === 'offer')
        const hasPricing = step.components.some((c) => c.kind === 'pricing_table')
        const isCheckout = step.components.some((c) => c.kind === 'checkout')
        const isOfferStep = step.components.length > 0 && step.components.every((c) => c.kind === 'offer')

        let actions
        if (isOutcome) {
          actions = (
            <BrandButton variant="ghost" onClick={() => store.resetSession()}>
              Close
            </BrandButton>
          )
        } else if (isCheckout) {
          actions = (
            <BrandButton onClick={() => store.completeCheckout()}>Confirm &amp; apply</BrandButton>
          )
        } else if (isConfirmation && confirmation?.kind === 'confirmation') {
          const c = confirmation
          const cancelDisabled =
            (c.variant === 'consent' && !session.consentChecked) ||
            (c.variant === 'type_confirm' && session.confirmInput.trim() !== c.confirmKeyword)
          actions = (
            <>
              <BrandButton variant="outline" onClick={() => store.keepSubscription()}>
                {c.keepCta}
              </BrandButton>
              <BrandButton
                variant="secondary"
                disabled={cancelDisabled}
                onClick={() => store.confirmCancel()}
              >
                {c.cancelCta}
              </BrandButton>
            </>
          )
        } else {
          const continueLabel =
            step.navContinueLabel ??
            (hasOffer || hasPricing ? 'No thanks, continue cancelling →' : 'Continue')
          actions = (
            <BrandButton
              onClick={() => (hasPricing ? store.declineOffer() : goTo(i + 1))}
              disabled={!stepSurveyReady(step)}
            >
              <span dangerouslySetInnerHTML={{ __html: continueLabel }} />
            </BrandButton>
          )
        }

        // Active slide sits at 0; earlier slides are parked above, later below.
        const offset = (i - index) * 100
        const isActive = i === index
        return (
          <div
            key={step.id}
            aria-hidden={!isActive}
            className="absolute inset-0"
            style={{
              transform: `translateY(${offset}%)`,
              transition: 'transform 520ms cubic-bezier(0.4, 0, 0.2, 1)',
              // Only the visible slide is interactive; parked slides can't be reached.
              pointerEvents: isActive ? 'auto' : 'none',
              visibility: Math.abs(i - index) > 1 ? 'hidden' : 'visible',
            }}
          >
            <StepFrame
              index={i}
              total={total}
              title={step.title}
              description={step.description}
              frame={experience.frame}
              branding={experience.branding}
              showBack={i > 0}
              onBack={isCheckout ? () => store.cancelCheckout() : () => goTo(i - 1)}
              onExit={() => store.resetSession()}
              hideTitleBlock={isConfirmation || isOutcome || isOfferStep || isCheckout}
              centerActions={(isConfirmation && total === 1) || isOutcome}
              actions={actions}
            >
              <StepRenderer step={step} />
            </StepFrame>
          </div>
        )
      })}
    </div>
  )
}
