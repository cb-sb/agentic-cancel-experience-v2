import type { ReactNode } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import type { AudienceKey } from '../journey/types'
import { playVariants, topSplit, type PlayVariant } from '../play/resolve'
import { useExperience } from '../store/useExperience'
import { audienceLabel, useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { AUDIENCE_LIBRARY, audienceSummary, type SplitMode } from '../types/orchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { TemplateStepThumb } from './TemplatePreviewStrip'

const AUDIENCE_KEYS: AudienceKey[] = ['all', 'paying', 'high_value', 'high_risk', 'annual', 'in_trial']

const MODES: { id: SplitMode; label: string; hint: string }[] = [
  { id: 'single', label: 'Single', hint: 'Everyone in the audience sees one cancel page.' },
  { id: 'percent', label: 'Test', hint: 'Split the audience by percent to compare cancel pages.' },
  { id: 'audience', label: 'Sub-audiences', hint: 'Send each sub-audience its own cancel page. Everyone else gets the fallback.' },
]

export function openVariantInEditor(experienceId: string) {
  const exp = useExperience.getState().experiences[experienceId]
  if (!exp) return
  const step = exp.steps.find((s) => !s.disabled) ?? exp.steps[0]
  useExperience.getState().setActiveExperience(experienceId)
  if (step) useOrchestration.getState().focusStep({ experienceId, stepId: step.id })
  openTab('editor')
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-[20px]">
      <div className="mb-[12px] flex items-center gap-[10px]">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-900 text-[12px] font-semibold text-white">
          {step}
        </span>
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Thumb({ experienceId }: { experienceId: string }) {
  const exp = useExperience((s) => s.experiences[experienceId])
  const steps = exp?.steps.filter((s) => !s.disabled) ?? []
  const first = steps[0]
  if (!exp || !first) {
    return (
      <div className="flex h-[176px] items-center justify-center text-[12px] text-slate-400">No screens yet</div>
    )
  }
  return (
    <div className="pointer-events-none flex h-[176px] items-start justify-center overflow-hidden pt-[10px]">
      <TemplateStepThumb
        step={first}
        index={0}
        total={steps.length}
        branding={exp.branding}
        frame={exp.frame}
        label={`${steps.length} screen${steps.length === 1 ? '' : 's'}`}
        acquire={false}
        scale={0.3}
      />
    </div>
  )
}

function VariantCard({
  variant,
  splitId,
  mode,
  removable,
}: {
  variant: PlayVariant
  splitId: string | null
  mode: SplitMode
  removable: boolean
}) {
  const setSplitPercents = useOrchestration((s) => s.setSplitPercents)
  const removeBranch = useOrchestration((s) => s.removeBranch)
  const updateBranchAudience = useOrchestration((s) => s.updateBranchAudience)
  const branch = useOrchestration((s) =>
    s.play.targeting.kind === 'split' ? s.play.targeting.branches.find((b) => b.id === variant.branchId) : undefined,
  )
  const segment = mode === 'audience' && variant.role === 'segment'
  const exp = variant.experienceId

  return (
    <div className="flex w-[228px] flex-none flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        disabled={!exp}
        onClick={() => exp && openVariantInEditor(exp)}
        title={exp ? `Edit ${variant.label}` : undefined}
        className="group relative bg-slate-50 text-left enabled:hover:bg-slate-100"
      >
        {exp ? (
          <Thumb experienceId={exp} />
        ) : (
          <div className="flex h-[176px] items-center justify-center px-[16px] text-center text-[12px] text-slate-500">
            These subscribers cancel with no cancel page.
          </div>
        )}
        {exp && (
          <span className="absolute right-[8px] top-[8px] rounded-md bg-white px-[6px] py-[2px] text-[11px] font-semibold text-slate-700 opacity-0 shadow-sm group-hover:opacity-100">
            Edit
          </span>
        )}
      </button>
      <div className="flex flex-col gap-[6px] border-t border-slate-100 p-[12px]">
        <div className="flex items-center justify-between gap-[8px]">
          <span className="truncate text-[13px] font-semibold text-slate-900">{variant.label}</span>
          {removable && splitId && (
            <button
              type="button"
              aria-label={`Remove ${variant.label}`}
              title={`Remove ${variant.label}`}
              onClick={() => removeBranch(splitId, variant.branchId)}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <SIcon name="x" size={13} />
            </button>
          )}
        </div>
        {mode === 'percent' && splitId ? (
          <label className="flex items-center gap-[6px] text-[12px] text-slate-600">
            <input
              type="number"
              min={0}
              max={100}
              value={variant.percent}
              onChange={(e) => setSplitPercents(splitId, { [variant.branchId]: Number(e.target.value) || 0 })}
              className="w-[56px] rounded-md border border-slate-200 px-[6px] py-[3px] text-right text-[12.5px] tabular-nums outline-none focus:border-slate-400"
            />
            % of the audience
          </label>
        ) : segment && splitId ? (
          <select
            value={branch?.audience?.savedAudienceId ?? ''}
            onChange={(e) => {
              const saved = AUDIENCE_LIBRARY.find((a) => a.id === e.target.value)
              if (!saved) return
              updateBranchAudience(splitId, variant.branchId, {
                name: saved.name,
                savedAudienceId: saved.id,
                match: saved.match,
                conditions: saved.conditions,
                targetAll: false,
              })
            }}
            className="w-full rounded-md border border-slate-200 bg-white px-[6px] py-[4px] text-[12.5px] text-slate-700 outline-none"
          >
            <option value="" disabled>
              Pick a saved audience
            </option>
            {AUDIENCE_LIBRARY.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[12px] text-slate-500">{variant.share}</span>
        )}
      </div>
    </div>
  )
}

/** The play's targeting, read the way Chargebee's play builder reads it: audience, then actions. */
export function TargetingTab() {
  const file = useJourney((s) => s.file)
  const patchFile = useJourney((s) => s.patchFile)
  const play = useOrchestration((s) => s.play)
  const setSplitMode = useOrchestration((s) => s.setSplitMode)
  const addVariant = useOrchestration((s) => s.addVariant)
  const addSubAudience = useOrchestration((s) => s.addSubAudience)
  const globalControl = useCancelSettings((s) => s.globalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const openSettings = useCancelSettings((s) => s.setSettingsOpen)
  const fallbackTitle = useWorkspace((s) => s.threads.find((t) => t.id === fallbackId)?.title)

  const split = topSplit(play)
  const mode: SplitMode = split?.mode ?? 'single'
  const variants = playVariants(play)
  const flowCount = variants.filter((v) => v.experienceId).length
  const total = variants.reduce((sum, v) => sum + v.percent, 0)

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto flex max-w-[860px] flex-col gap-[16px] px-[28px] py-[24px]">
        <Section step={1} title="Audience">
          <p className="mb-[10px] text-[12.5px] text-slate-500">Who can get this cancel page when they click Cancel.</p>
          <select
            value={file.audience}
            onChange={(e) => patchFile({ audience: e.target.value as AudienceKey })}
            className="w-full max-w-[360px] rounded-lg border border-slate-200 bg-white px-[10px] py-[7px] text-[13px] text-slate-800 outline-none hover:border-slate-300 focus:border-slate-400"
          >
            {AUDIENCE_KEYS.map((key) => (
              <option key={key} value={key}>
                {key === 'all' ? 'Target all subscribers' : audienceLabel(key)}
              </option>
            ))}
          </select>
          {!play.audience.targetAll && (
            <p className="mt-[8px] font-mono text-[11.5px] text-slate-500">{audienceSummary(play.audience)}</p>
          )}
          <p className="mt-[10px] text-[12px] text-slate-400">
            Cancel pages have no trigger. They open when a subscriber clicks Cancel.
          </p>
        </Section>

        <Section step={2} title="Actions">
          <div role="radiogroup" aria-label="Action type" className="flex w-fit rounded-lg bg-slate-100 p-[3px]">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => split && setSplitMode(split.id, m.id)}
                className={`rounded-md px-[12px] py-[5px] text-[12.5px] font-semibold ${
                  mode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-[8px] text-[12.5px] text-slate-500">{MODES.find((m) => m.id === mode)?.hint}</p>

          <div className="mt-[16px] flex gap-[12px] overflow-x-auto pb-[4px]">
            {variants.map((v) => (
              <VariantCard
                key={v.branchId}
                variant={v}
                splitId={split?.id ?? null}
                mode={mode}
                removable={mode !== 'single' && v.role !== 'fallback' && (flowCount > 1 || !v.experienceId)}
              />
            ))}
          </div>
          {mode === 'percent' && total !== 100 && (
            <p className="mt-[8px] text-[12px] font-medium text-rose-600">Shares add up to {total}%. Make them 100%.</p>
          )}
          {split && (
            <div className="mt-[12px] flex gap-[8px]">
              {mode === 'audience' ? (
                <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => addSubAudience(split.id)}>
                  Add sub-audience
                </SButton>
              ) : (
                <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => addVariant(split.id)}>
                  {mode === 'single' ? 'Run a test' : 'Add variant'}
                </SButton>
              )}
            </div>
          )}
        </Section>

        <div className="rounded-2xl border border-dashed border-slate-300 px-[20px] py-[14px] text-[12.5px] text-slate-500">
          <p>
            <span className="font-semibold text-slate-600">Global control:</span>{' '}
            {globalControl === 0
              ? 'Off. Everyone who clicks Cancel can get a cancel page.'
              : `${globalControl}% of everyone who clicks Cancel gets no cancel page, across all cancel experiences.`}
          </p>
          <p className="mt-[4px]">
            <span className="font-semibold text-slate-600">Global fallback:</span>{' '}
            {fallbackTitle
              ? `${fallbackTitle}, for subscribers no cancel experience's audience matches.`
              : 'None. Subscribers no audience matches cancel with no cancel page.'}
          </p>
          <button
            type="button"
            onClick={() => openSettings(true)}
            className="mt-[8px] font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Change in cancel page settings
          </button>
        </div>
      </div>
    </div>
  )
}
