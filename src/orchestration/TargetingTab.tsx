import type { ReactNode } from 'react'
import type { AudienceKey } from '../journey/types'
import { audienceLabel, useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { audienceSummary } from '../types/orchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { useWorkspace } from '../workspace/useWorkspace'
import { SplitEditor } from './targeting/SplitEditor'

export { openVariantInEditor } from './targeting/SplitEditor'

const AUDIENCE_KEYS: AudienceKey[] = ['all', 'paying', 'high_value', 'high_risk', 'annual', 'in_trial']

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

/** The play's targeting, read the way Chargebee's play builder reads it: audience, then actions. */
export function TargetingTab() {
  const file = useJourney((s) => s.file)
  const patchFile = useJourney((s) => s.patchFile)
  const play = useOrchestration((s) => s.play)
  const globalControl = useCancelSettings((s) => s.globalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const openSettings = useCancelSettings((s) => s.setSettingsOpen)
  const fallbackTitle = useWorkspace((s) => s.threads.find((t) => t.id === fallbackId)?.title)

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
          <SplitEditor />
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
