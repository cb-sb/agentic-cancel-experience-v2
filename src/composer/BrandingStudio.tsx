import { useMemo } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { DEFAULT_BRANDING } from '../lib/blueprints'
import { MatchSiteCard } from '../brand/MatchSiteCard'
import { compileJourney } from '../journey/compile'
import { startFromTemplate, withLive } from '../journey/templates'
import { EMPTY_JOURNEY } from '../journey/types'
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
import { BrandingPanel } from './BrandingPanel'
import type { ConfirmationComponent } from '../types/experience'
import type { PlaySession } from '../store/useExperience'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { CANCEL_ROUTE, useGrowthShell } from '../shell/useGrowthShell'

function idleSession(): PlaySession {
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
 * Experiences → Branding. Tokens plus a live device preview of the subscriber UI.
 * Copilot stays on copy/structure; this studio owns look for cancel and acquisition.
 */
export function BrandingStudio() {
  const go = useGrowthShell((s) => s.go)
  const file = useJourney((s) => s.file)
  const applyBrand = useJourney((s) => s.applyBrand)
  const live = useExperience((s) => s.experience)

  const preview = useMemo(() => {
    if (live.steps.some((s) => !s.disabled)) return live
    const started = startFromTemplate({ ...EMPTY_JOURNEY, brand: file.brand, shell: 'modal' }, 'cancel_4')
    return compileJourney({ ...started, steps: withLive(started.steps, true) }).experience
  }, [live, file.brand])

  const steps = preview.steps.filter((s) => !s.disabled && !isOutcomeStep(s))
  const step = steps[0] ?? preview.steps[0]
  const confirmation = step?.components.find((c): c is ConfirmationComponent => c.kind === 'confirmation')
  const isOfferStep = !!step && step.components.length > 0 && step.components.every((c) => c.kind === 'offer')

  const ctx: RenderCtxValue | null = step
    ? {
        mode: 'play',
        interactive: false,
        shell: preview.shell,
        device: 'tablet',
        branding: preview.branding,
        session: idleSession(),
        actions: defaultRenderActions,
        edit: null,
      }
    : null

  return (
    <div className="flex h-full min-h-0 bg-white">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-none items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Branding</h1>
            <p className="mt-1 max-w-lg text-[13px] text-slate-500">
              Every cancel and pricing-table experience uses this look. Native look is applied
              here — sample the live site, then tokens, then scoped CSS when a token cannot
              express the shape. The UI stays isolated from the host page.
            </p>
          </div>
          <SButton size="small" variant="neutral-outline" onClick={() => go(CANCEL_ROUTE)}>
            Open cancel experience
          </SButton>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden bg-slate-50 p-6">
          {step && ctx ? (
            <BrandRoot branding={preview.branding} className="h-full min-h-0 w-full">
              <DeviceChrome device="tablet" brandName={preview.branding.merchantName}>
                <div className="pointer-events-none">
                  <RenderProvider value={ctx}>
                    <StepFrame
                      index={0}
                      total={Math.max(steps.length, 1)}
                      title={step.title}
                      description={step.description}
                      frame={preview.frame}
                      branding={preview.branding}
                      showBack={false}
                      hideTitleBlock={!!confirmation || isOfferStep}
                      actions={
                        confirmation ? (
                          <>
                            <BrandButton variant="outline" type="button" tabIndex={-1}>
                              {confirmation.keepCta}
                            </BrandButton>
                            <BrandButton variant="secondary" type="button" tabIndex={-1}>
                              {confirmation.cancelCta}
                            </BrandButton>
                          </>
                        ) : (
                          <BrandButton type="button" tabIndex={-1}>
                            Continue
                          </BrandButton>
                        )
                      }
                    >
                      <StepRenderer step={step} />
                    </StepFrame>
                  </RenderProvider>
                </div>
              </DeviceChrome>
            </BrandRoot>
          ) : (
            <p className="text-[13px] text-slate-500">Prompt a journey to preview branding.</p>
          )}
        </div>
      </div>

      <aside className="flex w-[380px] flex-none flex-col overflow-hidden border-l border-slate-200">
        <div className="flex-none space-y-3 border-b border-slate-100 px-4 py-4">
          <MatchSiteCard />
          <SButton size="small" variant="neutral-outline" onClick={() => applyBrand({ ...DEFAULT_BRANDING }, false)}>
            Reset to Chargebee look
          </SButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <BrandingPanel />
        </div>
        <div className="flex-none border-t border-slate-100 px-4 py-3">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
            <SIcon name="info" size={14} className="mt-0.5 flex-none text-slate-300" />
            Host CSS never leaks in. Native look is tokens first, scoped CSS only for geometry
            the tokens cannot express.
          </p>
        </div>
      </aside>
    </div>
  )
}
