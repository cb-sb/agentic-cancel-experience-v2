import { useState } from 'react'

import { colorForOfferFactory, linkableOffers, offerStepIndex } from '../lib/mapping'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import type { SurveyComponent } from '../types/experience'

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim()

/**
 * Small editable popover that opens when a reason→offer connector is clicked.
 * Shows what the connection does and lets the merchant re-route or unlink it,
 * or jump straight into the offer's full configuration.
 */
export function ConnectionPopover({
  expId,
  optId,
  onClose,
}: {
  expId: string
  optId: string
  onClose: () => void
}) {
  const experiences = useExperience((s) => s.experiences)
  const setActiveExperience = useExperience((s) => s.setActiveExperience)
  const updateComponent = useExperience((s) => s.updateComponent)
  const focusStep = useOrchestration((s) => s.focusStep)
  const [picking, setPicking] = useState(false)

  const exp = experiences[expId]
  if (!exp) return null

  let surveyStepId = ''
  let survey: SurveyComponent | undefined
  for (const step of exp.steps) {
    const found = step.components.find((c) => c.kind === 'survey')
    if (found && found.kind === 'survey') {
      surveyStepId = step.id
      survey = found
      break
    }
  }
  if (!survey) return null

  const option = survey.options.find((o) => o.id === optId)
  if (!option) return null

  const offers = linkableOffers(exp)
  const colorFor = colorForOfferFactory(exp)
  const offerSteps = offerStepIndex(exp)
  const linked = offers.find((o) => o.id === option.linkedOfferId) ?? null

  const setLink = (offerId: string | null) => {
    setActiveExperience(expId)
    updateComponent(surveyStepId, survey!.id, {
      options: survey!.options.map((o) => (o.id === optId ? { ...o, linkedOfferId: offerId } : o)),
    })
    setPicking(false)
  }

  return (
    <div className="w-72 cursor-default rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
          Reason → offer routing
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5 text-[12.5px] leading-relaxed text-slate-600">
        When a subscriber picks{' '}
        <span className="font-semibold text-slate-900">“{stripTags(option.label) || 'this reason'}”</span>
        {linked ? (
          <>
            {' '}they’re shown{' '}
            <span
              className="inline-flex items-center gap-1 font-semibold text-slate-900"
              style={{ boxShadow: `inset 0 -2px 0 ${colorFor(linked.id)}` }}
            >
              {stripTags(linked.title) || 'this offer'}
            </span>
            .
          </>
        ) : (
          <> — no save offer is linked yet.</>
        )}
      </div>

      {picking ? (
        <div className="mt-2.5 space-y-1">
          <div className="px-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
            Route to
          </div>
          <button
            type="button"
            onClick={() => setLink(null)}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-slate-50 ${
              !option.linkedOfferId ? 'font-semibold text-slate-900' : 'text-slate-600'
            }`}
          >
            <span className="h-2 w-2 flex-none rounded-full border border-slate-300" />
            No linked offer
          </button>
          {offers.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setLink(o.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-slate-50 ${
                option.linkedOfferId === o.id ? 'font-semibold text-slate-900' : 'text-slate-600'
              }`}
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: colorFor(o.id) }} />
              <span className="truncate">{stripTags(o.title) || 'Offer'}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-700"
          >
            {linked ? 'Change offer' : 'Link an offer'}
          </button>
          {linked && (
            <>
              <button
                type="button"
                onClick={() => {
                  const stepId = offerSteps.get(linked.id)
                  if (stepId) {
                    focusStep({ experienceId: expId, stepId })
                    onClose()
                  }
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Configure offer
              </button>
              <button
                type="button"
                onClick={() => setLink(null)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-rose-500 hover:bg-rose-50"
              >
                Unlink
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
