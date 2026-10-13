import { SButton } from '@chargebee/sting-react'
import { OFFER_VARIANTS } from '../lib/offerVariants'
import { useJourney } from '../store/useJourney'
import { CB_KIND_LABELS, type CbKind } from './contract'
import { approveManifest, ManifestReview } from './ManifestReview'
import type { ManifestSlot, ManifestStep } from './types'

function kindLabel(kind: ManifestStep['kind']): string {
  return CB_KIND_LABELS[kind as CbKind] ?? kind
}

function bindLabel(slot: ManifestSlot): string {
  if (!slot.bind) return 'Not bound'
  if (slot.type === 'offer') return OFFER_VARIANTS.find((item) => item.category === slot.bind)?.label ?? slot.bind
  return slot.bind
}

const SLOT_LABEL: Record<ManifestSlot['type'], string> = {
  offer: 'Offer',
  survey: 'Survey',
  field: 'Field',
  action: 'Action',
}

function approveSummary() {
  approveManifest()
}

/** Summary of an uploaded page: only the steps, slots, and bindings the scan produced. */
export function ManifestSummary() {
  const file = useJourney((s) => s.file)
  const manifest = file.manifest
  const approved = !!manifest?.confirmed

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[840px] space-y-[20px] px-[28px] py-[28px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Summary</p>
          <h2 className="mt-[4px] text-[20px] font-semibold text-slate-900">{file.name}</h2>
          <p className="mt-[4px] text-[13px] text-slate-500">
            {approved
              ? 'Approved. Editor and Preview use this summary.'
              : 'Review what Chargebee read. Approving it saves this as the summary.'}
          </p>
        </div>

        {manifest && !approved && (
          <div className="flex items-center justify-between gap-[16px] border border-slate-200 bg-white px-[16px] py-[14px]">
            <p className="text-[13px] text-slate-600">Check survey reasons, the loss-aversion card, and offers before this summary is saved.</p>
            <SButton size="small" variant="primary" className="w-auto flex-none" onClick={approveSummary}>
              Approve
            </SButton>
          </div>
        )}

        {!manifest ? (
          <p className="text-[13px] text-slate-500">Upload a page from Pages to see its manifest.</p>
        ) : (
          <ManifestReview
            readOnly={approved}
            steps={{
              summary: manifest.steps.map((step) => kindLabel(step.kind)).join(' → ') || 'No steps',
              content: (
              <ol className="divide-y divide-slate-100">
                {manifest.steps.map((step, index) => (
                  <li key={step.id} className="py-[12px] first:pt-0 last:pb-0">
                    <div className="flex items-baseline gap-[8px]">
                      <span className="text-[12px] tabular-nums text-slate-400">{index + 1}</span>
                      <p className="text-[13.5px] font-semibold text-slate-900">{kindLabel(step.kind)}</p>
                      {step.file && <span className="truncate text-[12px] text-slate-400">{step.file}</span>}
                    </div>
                    {step.slots.length === 0 && step.fields.length === 0 ? (
                      <p className="mt-[6px] pl-[18px] text-[12.5px] text-slate-500">No slots on this step.</p>
                    ) : (
                      <ul className="mt-[8px] space-y-[4px] pl-[18px]">
                        {step.slots.map((slot) => (
                          <li key={slot.id} className="flex items-baseline gap-[8px] text-[12.5px]">
                            <span className="w-[64px] flex-none text-slate-500">{SLOT_LABEL[slot.type]}</span>
                            <span className="text-slate-800">{bindLabel(slot)}</span>
                          </li>
                        ))}
                        {step.fields.map((field) => (
                          <li key={field.name} className="flex items-baseline gap-[8px] text-[12.5px]">
                            <span className="w-[64px] flex-none text-slate-500">Field</span>
                            <span className="text-slate-800">{field.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              ),
            }}
          />
        )}
      </div>
    </div>
  )
}
