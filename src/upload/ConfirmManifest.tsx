import { SButton } from '@chargebee/sting-react'
import { OFFER_VARIANTS } from '../lib/offerVariants'
import type { JourneyStepKind } from '../journey/types'
import { CB_ACTIONS, DEFAULT_SUBSCRIBER_CONTEXT, type ManifestStep, type TemplateManifest } from './types'
import { validateManifest } from './validate'
import { useUpload } from './useUpload'

const KINDS: { id: JourneyStepKind; label: string }[] = [
  { id: 'loss_aversion', label: 'Loss aversion' },
  { id: 'survey', label: 'Survey' },
  { id: 'offer', label: 'Offer' },
  { id: 'confirmation', label: 'Confirmation' },
  { id: 'outcome_saved', label: 'Saved' },
  { id: 'outcome_cancelled', label: 'Cancelled' },
]

function patchStep(manifest: TemplateManifest, id: string, patch: Partial<ManifestStep>): TemplateManifest {
  return {
    ...manifest,
    steps: manifest.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none rounded-xl bg-[#E36A5A] px-4 py-3 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Confirm mappings</p>
        <p className="mt-0.5 text-[14px] font-semibold">Bind their chrome to Growth entities</p>
        <p className="mt-1 text-[12.5px] text-white/85">
          Layout change = new upload. Weekly copy and offer logic re-enters here. A/B uses the
          existing split: two uploads as treatments, or one template with different offer binds, or
          holdout.
        </p>
      </div>

      {manifest.warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          <p className="font-semibold">Scan guessed these — confirm or fix</p>
          <ul className="mt-1 list-disc pl-4">
            {manifest.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {manifest.steps.map((step, index) => (
          <article key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Step {index + 1}
              </span>
              <input
                value={step.id}
                onChange={(e) => {
                  const id = e.target.value.replace(/\s+/g, '_') || step.id
                  const next = manifest.steps.map((s) => (s === step ? { ...s, id } : s))
                  setManifest({ ...manifest, steps: next })
                }}
                className="w-36 rounded-md border border-slate-200 px-2 py-1 text-[12.5px] font-semibold text-slate-800"
              />
              <select
                value={step.kind}
                onChange={(e) => setManifest(patchStep(manifest, step.id, { kind: e.target.value as JourneyStepKind }))}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12.5px]"
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              {step.file && <span className="text-[11px] text-slate-400">{step.file}</span>}
              {index < manifest.steps.length - 1 && (
                <button
                  type="button"
                  className="ml-auto text-[11.5px] font-semibold text-slate-500 hover:text-slate-800"
                  onClick={() => {
                    const steps = [...manifest.steps]
                    const cur = steps[index]
                    const nxt = steps[index + 1]
                    steps.splice(index, 2, {
                      ...cur,
                      slots: [...cur.slots, ...nxt.slots],
                      fields: [...cur.fields, ...nxt.fields],
                    })
                    setManifest({
                      ...manifest,
                      warnings: [
                        ...manifest.warnings,
                        `Merged "${nxt.id}" into "${cur.id}"`,
                      ],
                      steps,
                    })
                  }}
                >
                  Merge with next
                </button>
              )}
            </div>

            {step.slots.length > 0 && (
              <ul className="mt-3 space-y-2">
                {step.slots.map((slot) => (
                  <li key={`${slot.type}:${slot.id}`} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="w-16 font-semibold uppercase tracking-wide text-slate-400">{slot.type}</span>
                    <span className="min-w-[88px] text-slate-700">{slot.id}</span>
                    {slot.type === 'offer' && (
                      <select
                        value={slot.bind ?? 'discount'}
                        onChange={(e) =>
                          setManifest(
                            patchStep(manifest, step.id, {
                              slots: step.slots.map((s) =>
                                s === slot ? { ...s, bind: e.target.value } : s,
                              ),
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
                    )}
                    {slot.type === 'survey' && (
                      <span className="text-slate-500">
                        {(manifest.surveyReasons ?? []).length} reasons · add below
                      </span>
                    )}
                    {slot.type === 'action' && (
                      <select
                        value={slot.bind ?? ''}
                        onChange={(e) =>
                          setManifest(
                            patchStep(manifest, step.id, {
                              slots: step.slots.map((s) =>
                                s === slot ? { ...s, bind: e.target.value } : s,
                              ),
                            }),
                          )
                        }
                        className="rounded-md border border-slate-200 px-2 py-1"
                      >
                        <option value="">Choose…</option>
                        {CB_ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    )}
                    {slot.type === 'field' && (
                      <input
                        value={slot.bind ?? slot.id}
                        onChange={(e) =>
                          setManifest(
                            patchStep(manifest, step.id, {
                              slots: step.slots.map((s) =>
                                s === slot ? { ...s, bind: e.target.value } : s,
                              ),
                            }),
                          )
                        }
                        className="w-40 rounded-md border border-slate-200 px-2 py-1 font-mono text-[12px]"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {step.fields.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Fields</p>
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

        {manifest.steps.some((s) => s.kind === 'survey') && (
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

        <button
          type="button"
          className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[12.5px] text-slate-500 hover:bg-slate-50"
          onClick={() =>
            setManifest({
              ...manifest,
              warnings: [
                ...manifest.warnings,
                'Added an empty step — re-upload if the page markup is missing.',
              ],
              steps: [
                ...manifest.steps,
                { id: `step_${manifest.steps.length + 1}`, kind: 'survey', slots: [], fields: [] },
              ],
            })
          }
        >
          Add a step the scan missed
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 list-disc rounded-lg border border-rose-200 bg-rose-50 px-5 py-2 text-[12.5px] text-rose-800">
          {errors.map((e) => (
            <li key={e.message}>{e.message}</li>
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
          Confirm and host
        </SButton>
      </div>
    </div>
  )
}
