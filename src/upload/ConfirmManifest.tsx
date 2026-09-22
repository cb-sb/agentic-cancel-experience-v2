import { SButton } from '@chargebee/sting-react'
import { OFFER_VARIANTS } from '../lib/offerVariants'
import { CB_KIND_LABELS, type CbKind } from './contract'
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

function kindJob(kind: ManifestStep['kind']): string {
  switch (kind) {
    case 'loss_aversion':
      return 'Shows what they keep and lose. Sample numbers below are for preview.'
    case 'survey':
      return 'Why they’re leaving. Edit the reasons below.'
    case 'offer':
      return 'The save. Pick which catalog offer fills this screen.'
    case 'confirmation':
      return 'Last chance to stay or leave.'
    case 'pricing_table':
      return 'Plan picker before checkout.'
    case 'checkout':
      return 'Hosted checkout handoff.'
    case 'outcome_saved':
      return 'They stayed.'
    case 'outcome_cancelled':
      return 'They left.'
    default:
      return 'A marked screen from the pack you uploaded.'
  }
}

function fieldLabel(name: string): string {
  return name.replace(/_/g, ' ')
}

function needsBindCard(step: ManifestStep): boolean {
  return step.slots.some((s) => s.type === 'offer') || step.fields.length > 0
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
  const bindable = manifest.steps.filter(needsBindCard)
  const chain = manifest.steps.map((s) => kindLabel(s.kind)).join(' → ')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none rounded-xl bg-[#E36A5A] px-4 py-3 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Catalog binds</p>
        <p className="mt-0.5 text-[14px] font-semibold">Bind the save (and survey) from your catalog</p>
        {chain && (
          <p className="mt-1 text-[12.5px] text-white/85">
            Screens in this pack: {chain}. Layout stays as uploaded — Copilot still owns targeting and publish.
          </p>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {bindable.map((step) => (
          <article key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-[14px] font-semibold text-slate-900">{kindLabel(step.kind)}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{kindJob(step.kind)}</p>

            {step.slots.some((s) => s.type === 'offer') && (
              <ul className="mt-3 space-y-2">
                {step.slots
                  .filter((s) => s.type === 'offer')
                  .map((slot) => (
                    <li key={`${slot.type}:${slot.id}`} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <label className="w-16 font-semibold uppercase tracking-wide text-slate-400" htmlFor={`bind-${step.id}-${slot.id}`}>
                        Offer
                      </label>
                      <select
                        id={`bind-${step.id}-${slot.id}`}
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
                      <span className="w-40 text-[12px] capitalize text-slate-700">{fieldLabel(field.name)}</span>
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
            <h3 className="text-[14px] font-semibold text-slate-900">Survey</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
              Why they’re leaving. These reasons fill the survey screen.
            </p>
            <ul className="mt-3 space-y-2">
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

        {bindable.length === 0 && !hasSurvey && (
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
