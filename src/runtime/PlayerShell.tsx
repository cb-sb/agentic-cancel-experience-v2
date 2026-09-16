import { useMemo } from 'react'
import { buildStepColumns, isOutcomeStep } from '../lib/stepColumns'
import { useExperience } from '../store/useExperience'
import type { ConfirmationComponent, OutcomeComponent } from '../types/experience'
import { RenderProvider, type RenderActions, type RenderCtxValue } from '../render/RenderContext'
import { StepFrame } from '../render/StepFrame'
import { StepRenderer } from '../render/StepRenderer'
import { BrandButton, BrandRoot } from '../render/BrandUI'
import { OutcomeCard } from '../render/components/OutcomeCard'
import { DummyCheckout } from './DummyCheckout'
import { FullPageScroll } from './FullPageScroll'
import { useJourney } from '../store/useJourney'
import { ArtifactPlayer } from '../upload/ArtifactPlayer'
import { canPlayUploaded } from '../upload/validate'
import { ChromeStepPlayer, stepChrome } from '../library/ChromePlayer'

export function PlayerShell() {
  const experience = useExperience((s) => s.experience)
  const session = useExperience((s) => s.session)
  const device = useExperience((s) => s.device)
  const store = useExperience()
  const file = useJourney((s) => s.file)
  const uploaded = file.source === 'uploaded' && !!file.artifact && !!file.manifest

  // Disabled steps stay in the composer but are skipped for the subscriber.
  const steps = experience.steps.filter((s) => !s.disabled)
  if (steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Prompt a journey to preview it
      </div>
    )
  }
  const step = steps[Math.min(session.index, steps.length - 1)]

  /**
   * "Step 2 of 4" counts what the subscriber walks through, not what the
   * composer holds: interchangeable offers are one moment, and the two outcomes
   * are where the journey ends rather than a stop along it. Same arithmetic the
   * canvas and the focus rail use, so all three agree on the number.
   */
  const { index, total } = useMemo(() => {
    const cols = buildStepColumns(steps)
    const journey = cols.filter((c) => !c.steps.every(({ step: s }) => isOutcomeStep(s)))
    const col = cols.findIndex((c) => c.steps.some(({ step: s }) => s.id === step?.id))
    return { index: Math.min(Math.max(col, 0), journey.length - 1), total: journey.length }
  }, [steps, step?.id])

  const actions: RenderActions = useMemo(
    () => ({
      selectReason: store.selectReason,
      setReasonText: store.setReasonText,
      acceptOffer: store.acceptOffer,
      declineOffer: store.declineOffer,
      setConfirmInput: store.setConfirmInput,
      setConsent: store.setConsent,
      setFeedback: store.setFeedback,
      confirmCancel: store.confirmCancel,
    }),
    [store],
  )

  const confirmationComponent = useMemo(
    () =>
      steps
        .flatMap((s) => s.components)
        .find((c): c is ConfirmationComponent => c.kind === 'confirmation'),
    [steps],
  )

  /**
   * The terminal for how this session actually ended. Kept and saved both land
   * on the saved card; the copy is whatever the merchant wrote on it, rather
   * than one card silently substituting three different headlines.
   */
  const outcomeComponent = useMemo(() => {
    const all = steps
      .flatMap((s) => s.components)
      .filter((c): c is OutcomeComponent => c.kind === 'outcome')
    const want = session.result === 'cancelled' ? 'cancelled' : 'saved'
    return all.find((c) => c.forResult === want) ?? all[0]
  }, [steps, session.result])

  const acceptedComponent = useMemo(
    () =>
      steps.flatMap((s) => s.components).find((c) => c.id === session.checkout.offerId),
    [steps, session.checkout.offerId],
  )

  const ctxValue: RenderCtxValue = {
    mode: 'play',
    interactive: true,
    shell: experience.shell,
    device,
    branding: experience.branding,
    session,
    actions,
    edit: null,
  }

  // Full-page shells need their brand wrapper to fill the device screen height.
  const wrapClass = experience.shell !== 'modal' ? 'h-full' : undefined

  // ---- Outcome (cancelled / saved) -----------------------------------------
  if (!uploaded && session.result && outcomeComponent) {
    return (
      <RenderProvider value={ctxValue}>
        <BrandRoot branding={experience.branding} className={wrapClass}>
          <StepFrame
            index={total - 1}
            total={total}
            title=""
            description=""
            frame={experience.frame}
            branding={experience.branding}
            showBack={false}
            hideTitleBlock
            actions={
              <BrandButton variant="ghost" onClick={() => store.resetSession()}>
                Close
              </BrandButton>
            }
          >
            <OutcomeCard
              component={outcomeComponent}
              result={session.result}
              onUndo={store.undoCancel}
            />
          </StepFrame>
        </BrandRoot>
      </RenderProvider>
    )
  }

  // ---- Dummy checkout (billing-altering offer) -----------------------------
  if (session.checkout.open) {
    return (
      <RenderProvider value={ctxValue}>
        <BrandRoot branding={experience.branding} className={wrapClass}>
          <StepFrame
            index={index}
            total={total}
            title="Complete your change"
            description=""
            frame={experience.frame}
            branding={experience.branding}
            showBack
            onBack={store.cancelCheckout}
            onExit={store.resetSession}
            hideTitleBlock
            actions={
              <BrandButton onClick={store.completeCheckout}>Confirm &amp; apply</BrandButton>
            }
          >
            <DummyCheckout component={acceptedComponent} />
          </StepFrame>
        </BrandRoot>
      </RenderProvider>
    )
  }

  if (stepChrome(file, step.id)) {
    return (
      <div className="h-full min-h-0 w-full overflow-hidden bg-white">
        <ChromeStepPlayer file={file} stepId={step.id} interactive />
      </div>
    )
  }

  if (uploaded && file.artifact && file.manifest) {
    if (!canPlayUploaded(file.manifest)) {
      return (
        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-slate-500">
          Confirm template mappings before walking this as a subscriber.
        </div>
      )
    }
    return (
      <div className="h-full min-h-0 w-full overflow-hidden bg-white">
        <ArtifactPlayer artifact={file.artifact} manifest={file.manifest} interactive />
      </div>
    )
  }

  // ---- Regular step --------------------------------------------------------
  const isConfirmation = step.components.some((c) => c.kind === 'confirmation')
  const isOutcome = step.components.some((c) => c.kind === 'outcome')
  const isCheckout = step.components.some((c) => c.kind === 'checkout')
  const isOfferStep = step.components.length > 0 && step.components.every((c) => c.kind === 'offer')
  const hasSurvey = step.components.some((c) => c.kind === 'survey')
  const hasOffer = step.components.some((c) => c.kind === 'offer')
  const hasPricing = step.components.some((c) => c.kind === 'pricing_table')

  const surveyReady = (() => {
    if (!hasSurvey) return true
    const survey = step.components.find((c) => c.kind === 'survey')
    if (survey?.kind === 'survey' && survey.presentation === 'free_text') {
      return (session.reasonText['free'] ?? '').trim().length > 0
    }
    return !!session.selectedReasonId
  })()

  let footerActions
  if (isCheckout) {
    footerActions = (
      <BrandButton onClick={() => store.completeCheckout()}>Confirm &amp; apply</BrandButton>
    )
  } else if (isConfirmation && confirmationComponent) {
    const c = confirmationComponent
    const cancelDisabled =
      (c.variant === 'consent' && !session.consentChecked) ||
      (c.variant === 'type_confirm' && session.confirmInput.trim() !== c.confirmKeyword)
    footerActions = (
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
    footerActions = (
      <BrandButton onClick={hasPricing ? store.declineOffer : store.goNext} disabled={!surveyReady}>
        <span dangerouslySetInnerHTML={{ __html: continueLabel }} />
      </BrandButton>
    )
  }

  // Full-page vertical-scroll shell: stack every step as a scrollable section.
  if (experience.shell === 'fullpage_scroll') {
    return (
      <RenderProvider value={ctxValue}>
        <BrandRoot branding={experience.branding} className={wrapClass}>
          <FullPageScroll />
        </BrandRoot>
      </RenderProvider>
    )
  }

  return (
    <RenderProvider value={ctxValue}>
      <BrandRoot branding={experience.branding} className={wrapClass}>
        <StepFrame
          index={index}
          total={total}
          title={step.title}
          description={step.description}
          frame={experience.frame}
          branding={experience.branding}
          showBack={session.index > 0}
          onBack={isCheckout ? store.cancelCheckout : store.goBack}
          onExit={store.resetSession}
          hideTitleBlock={isConfirmation || isOutcome || isOfferStep || isCheckout}
          centerActions={isConfirmation && total === 1}
          actions={footerActions}
        >
          <StepRenderer step={step} />
        </StepFrame>
      </BrandRoot>
    </RenderProvider>
  )
}
