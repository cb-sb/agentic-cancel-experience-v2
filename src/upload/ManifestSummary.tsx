import { OFFER_VARIANTS } from '../lib/offerVariants'
import { useJourney } from '../store/useJourney'
import { CB_KIND_LABELS, type CbKind } from './contract'
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

/** Summary of an uploaded page: only the steps, slots, and bindings the scan produced. */
export function ManifestSummary() {
  const file = useJourney((s) => s.file)
  const manifest = file.manifest
  const offers = [
    ...new Set(
      (manifest?.steps ?? []).flatMap((step) =>
        step.slots.filter((slot) => slot.type === 'offer').map((slot) => bindLabel(slot)),
      ),
    ),
  ]

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[720px] space-y-[20px] px-[28px] py-[28px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Summary</p>
          <h2 className="mt-[4px] text-[20px] font-semibold text-slate-900">{file.name}</h2>
          <p className="mt-[4px] text-[13px] text-slate-500">
            What Chargebee read from this page. Editor and Preview use the same upload.
          </p>
        </div>

        {!manifest ? (
          <p className="text-[13px] text-slate-500">Upload a page from Pages to see its manifest.</p>
        ) : (
          <>
            <section className="border border-slate-200 bg-white">
              <header className="border-b border-slate-100 px-[16px] py-[12px]">
                <h3 className="text-[14px] font-semibold text-slate-900">Steps</h3>
                <p className="mt-[2px] text-[12.5px] text-slate-500">{manifest.steps.map((step) => kindLabel(step.kind)).join(' → ') || 'No steps'}</p>
              </header>
              <ol>
                {manifest.steps.map((step, index) => (
                  <li key={step.id} className="border-b border-slate-100 px-[16px] py-[14px] last:border-b-0">
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
            </section>

            <section className="border border-slate-200 bg-white px-[16px] py-[14px]">
              <h3 className="text-[14px] font-semibold text-slate-900">Offers placed</h3>
              <p className="mt-[4px] text-[13px] text-slate-700">{offers.length ? offers.join(', ') : 'None'}</p>
            </section>

            <section className="border border-slate-200 bg-white px-[16px] py-[14px]">
              <h3 className="text-[14px] font-semibold text-slate-900">Survey reasons</h3>
              {(manifest.surveyReasons ?? []).length === 0 ? (
                <p className="mt-[4px] text-[13px] text-slate-500">None</p>
              ) : (
                <ul className="mt-[8px] space-y-[4px]">
                  {manifest.surveyReasons?.map((reason) => (
                    <li key={reason.id} className="text-[13px] text-slate-700">
                      {reason.label}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
