import { SButton } from '@chargebee/sting-react'
import { OFFER_VARIANTS } from '../lib/offerVariants'
import { CB_KIND_LABELS, CONTRACT_VERSION, type CbKind } from './contract'
import { DEFAULT_SUBSCRIBER_CONTEXT, type ManifestStep, type TemplateManifest } from './types'
import { formatContractIssue, validateManifest } from './validate'
import { useUpload } from './useUpload'

function patchStep(manifest: TemplateManifest, id: string, patch: Partial<ManifestStep>): TemplateManifest {
  return {
    ...manifest,
    steps: manifest.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }
}

function kindLabel(kind: ManifestStep['kind']): string {
  return CB_KIND_LABELS[kind as CbKind] ?? kind
}

export function ConfirmManifest({ onConfirmed }: { onConfirmed?: () => void }) {
  const manifest = useUpload((s) => s.manifest)
  const setManifest = useUpload((s) => s.setManifest)
  const confirm = useUpload((s) => s.confirm)
  const backToPick = useUpload((s) => s.backToPick)
  const mappingOnly = useUpload((s) => s.mappingOnly)
  if (!manifest) return null

  const issues = validateManifest({ ...manifest, confirmed: true })
  const errors = issues.filter((i) => i.level === 'error')
  const ready = errors.length === 0

  const ctx = { ...DEFAULT_SUBSCRIBER_CONTEXT, ...manifest.subscriberContext }
  const hasSurvey = manifest.steps.some((s) => s.kind === 'survey')
  const hasOffer = manifest.steps.some((s) => s.slots.some((slot) => slot.type === 'offer'))
  const hasFields = manifest.steps.some((s) => s.fields.length > 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none rounded-xl bg-[#E36A5A] px-4 py-3 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Catalog binds</p>
        <p className="mt-0.5 text-[14px] font-semibold">Pick which offer and reason list this chrome uses</p>
        <p className="mt-1 text-[12.5px] text-white/85">
          Step kinds and slots come from contract {CONTRACT_VERSION}. Layout change = new upload.
          Targeting, holdout, and publish stay in Copilot.
        </p>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {manifest.steps.map((step, index) => (
          <article key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Step {index + 1}
              </span>
              <span className="text-[12.5px] font-semibold text-slate-800">{step.id}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600">
                {kindLabel(step.kind)}
              </span>
              {step.file && <span className="text-[11px] text-slate-400">{step.file}</span>}
            </div>

            {step.slots.filter((s) => s.type === 'action').length > 0 && (
              <p className="mt-2 text-[12px] text-slate-500">
                Actions:{' '}
                {step.slots
                  .filter((s) => s.type === 'action')
                  .map((s) => s.bind ?? s.id.replace(/^action_/, ''))
                  .join(', ')}
              </p>
            )}

            {step.slots.some((s) => s.type === 'offer') && (
              <ul className="mt-3 space-y-2">
                {step.slots
                  .filter((s) => s.type === 'offer')
                  .map((slot) => (
                    <li key={`${slot.type}:${slot.id}`} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <span className="w-16 font-semibold uppercase tracking-wide text-slate-400">Offer</span>
                      <select
                        value={slot.bind ?? 'discount'}
                        onChange={(e) =>
                          setManifest(
                            patchStep(manifest, step.id, {
                              slots: step.slots.map((s) => (s === slot ? { ...s, bind: e.target.value } : s)),
                            }),
                          )
                        }
                        className="rounded-md border border-slate-200 px-2 py-1"
                      >
                        {OFFER_VARIANTS.map((v) => (
                          <option key={v.category} value={v.category}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
              </ul>
            )}

            {step.fields.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Preview samples
                </p>
                <ul className="mt-2 space-y-2">
                  {step.fields.map((field) => (
                    <li key={field.name} className="flex flex-wrap items-center gap-2">
                      <code className="w-40 text-[12px] text-slate-700">{field.name}</code>
                      <input
                        value={ctx[field.name] ?? field.sample ?? ''}
                        onChange={(e) =>
                          setManifest({
                            ...manifest,
                            subscriberContext: { ...ctx, [field.name]: e.target.value },
                          })
                        }
                        className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[12.5px]"
                        placeholder="Sample for preview"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}

        {hasSurvey && (
          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Survey reasons</p>
            <ul className="mt-2 space-y-2">
              {(manifest.surveyReasons ?? []).map((r, i) => (
                <li key={r.id} className="flex gap-2">
                  <input
                    value={r.label}
                    onChange={(e) => {
                      const surveyReasons = [...(manifest.surveyReasons ?? [])]
                      surveyReasons[i] = { ...r, label: e.target.value }
                      setManifest({ ...manifest, surveyReasons })
                    }}
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-[12.5px]"
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-2 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800"
              onClick={() =>
                setManifest({
                  ...manifest,
                  surveyReasons: [
                    ...(manifest.surveyReasons ?? []),
                    { id: `reason_${Date.now()}`, label: 'New reason' },
                  ],
                })
              }
            >
              Add a reason
            </button>
          </article>
        )}

        {!hasOffer && !hasSurvey && !hasFields && (
          <p className="text-[12.5px] text-slate-500">
            No catalog binds on this pack. Chrome is marked — confirm to host.
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 list-disc rounded-lg border border-rose-200 bg-rose-50 px-5 py-2 text-[12.5px] text-rose-800">
          {errors.map((e) => (
            <li key={formatContractIssue(e)}>{formatContractIssue(e)}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-none items-center justify-between gap-2">
        <SButton size="small" variant="neutral-outline" onClick={backToPick}>
          {mappingOnly ? 'Replace file' : 'Back'}
        </SButton>
        <SButton
          size="small"
          variant="primary"
          disabled={!ready}
          onClick={() => {
            confirm()
            onConfirmed?.()
          }}
        >
          Confirm, save to My templates
        </SButton>
      </div>
    </div>
  )
}
