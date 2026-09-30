import { useEffect, useMemo, useState } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import type { SampleSubscriber } from '../play/resolve'
import { markTested } from '../setup/useSetupState'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { openExperience } from './navigate'
import { lookupSubscribers } from './population'
import { runPlay, type PlayRun } from './resolve'
import { variantLetter, type CancelPlay } from './types'
import { logSession, markWalked, useTestSessions } from './useTestSessions'

const STEP_NAME: Record<string, string> = {
  global: 'Global control',
  audience: 'Audience',
  control: 'Control group',
  split: 'Split',
}

export function outcomeText(run: PlayRun, play: CancelPlay, titleOf: (id: string) => string): string {
  switch (run.outcome.kind) {
    case 'global_control':
      return 'Held back by global control. They cancel with no cancel page.'
    case 'outside':
      return `Not in ${play.name}. The next play in the order gets a chance, then the fallback.`
    case 'play_control':
      return 'In the control group. They cancel with no cancel page.'
    case 'no_variant':
      return 'Nothing to show yet. This play has no variant for them.'
    case 'variant':
      return `Sees Variant ${run.outcome.letter}, ${titleOf(run.outcome.experienceId)}.`
  }
}

function ago(at: number): string {
  const m = Math.round((Date.now() - at) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

export function SubscriberPicker({ selected, onPick }: { selected: SampleSubscriber | null; onPick: (s: SampleSubscriber) => void }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => lookupSubscribers(query), [query])
  return (
    <div>
      <label className="block">
        <span className="sr-only">Look up a subscriber</span>
        <div className="flex items-center gap-[6px] rounded-xl border border-slate-200 bg-white px-[10px] py-[7px] focus-within:border-slate-400">
          <SIcon name="search" size={13} className="flex-none text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or subscriber ID" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-300" />
        </div>
      </label>
      <div className="mt-[8px] flex flex-col gap-[4px]">
        {results.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            aria-pressed={selected?.id === s.id}
            className={`flex items-center gap-[8px] rounded-xl border px-[10px] py-[6px] text-left ${selected?.id === s.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
          >
            <span className={`flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full text-[11px] font-bold ${selected?.id === s.id ? 'bg-white/15' : 'bg-slate-100 text-slate-600'}`}>{s.name[0]}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">{s.name}</span>
              <span className={`block truncate text-[11px] ${selected?.id === s.id ? 'text-white/70' : 'text-slate-500'}`}>{s.summary}</span>
            </span>
          </button>
        ))}
        {results.length === 0 && <p className="px-[4px] text-[12px] text-slate-500">Nobody by that name or ID.</p>}
      </div>
    </div>
  )
}

/**
 * Pick a subscriber and watch the path light up. Forcing a variant skips the
 * split so you can walk any of them. None of this reaches reporting.
 */
export function TestDrawer({ play, onRun, onClose }: { play: CancelPlay; onRun: (run: PlayRun | null) => void; onClose: () => void }) {
  const globalControl = useCancelSettings((s) => s.globalControl)
  const threads = useWorkspace((s) => s.threads)
  const allSessions = useTestSessions((s) => s.sessions)
  const sessions = useMemo(() => allSessions.filter((x) => x.playId === play.id).slice(0, 6), [allSessions, play.id])
  const [sub, setSub] = useState<SampleSubscriber | null>(null)
  const [force, setForce] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const titleOf = (id: string) => threads.find((t) => t.id === id)?.title ?? 'an experience'

  const run = useMemo(() => (sub ? runPlay(play, sub, globalControl, { forceVariantId: force || undefined }) : null), [sub, play, globalControl, force])

  useEffect(() => {
    onRun(run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  useEffect(() => {
    if (!run || !sub) return
    markTested(play.id)
    setSessionId(logSession({ playId: play.id, subscriberId: sub.id, subscriberName: sub.name, result: outcomeText(run, play, titleOf), forced: Boolean(force), walked: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id, force])

  const walk = () => {
    if (!run || run.outcome.kind !== 'variant') return
    if (sessionId) markWalked(sessionId)
    openExperience(run.outcome.experienceId, play.id)
    useWorkspaceUi.setState({ previewAs: '' })
    openTab('preview')
  }

  return (
    <aside aria-label="Test this play" className="flex h-full w-[340px] flex-none flex-col border-l border-slate-200 bg-white">
      <header className="flex items-center gap-[8px] border-b border-slate-100 px-[14px] py-[10px]">
        <SIcon name="flask-conical" size={14} className="text-slate-500" />
        <h3 className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-900">Test with a subscriber</h3>
        <button type="button" onClick={onClose} aria-label="Close test" className="rounded-lg p-[4px] text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <SIcon name="x" size={14} />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-[16px] overflow-y-auto px-[14px] py-[12px]">
        <SubscriberPicker selected={sub} onPick={setSub} />

        {play.variants.length > 1 && (
          <label className="block">
            <span className="text-[11.5px] font-medium text-slate-500">Force a variant</span>
            <select value={force} onChange={(e) => setForce(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-slate-400">
              <option value="">No, use the real split</option>
              {play.variants.map((v, i) => (
                <option key={v.id} value={v.id}>
                  Variant {variantLetter(i)}, {titleOf(v.experienceId)}
                </option>
              ))}
            </select>
          </label>
        )}

        {run && sub && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-[12px]">
            <p className="text-[13px] font-semibold text-slate-900">{sub.name}</p>
            <p className="mt-[2px] text-[12.5px] text-slate-700">{outcomeText(run, play, titleOf)}</p>
            <ol className="mt-[10px] space-y-[6px]">
              {run.trace.map((t) => (
                <li key={t.node} className="flex items-start gap-[8px] text-[12px]">
                  <SIcon name={t.passed ? 'circle-check' : 'circle-x'} size={14} className={`mt-[1px] flex-none ${t.passed ? 'text-indigo-500' : 'text-amber-500'}`} />
                  <span className="min-w-0">
                    <span className="font-medium text-slate-800">{STEP_NAME[t.node]}</span>
                    <span className="text-slate-500">. {t.reason}</span>
                  </span>
                </li>
              ))}
            </ol>
            {run.outcome.kind === 'variant' && (
              <SButton size="small" variant="primary" className="mt-[12px] w-full" onClick={walk}>
                Walk it as {sub.name}
              </SButton>
            )}
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recent tests</h4>
            <span className="text-[11px] text-slate-400">Not counted in reporting</span>
          </div>
          <ul className="mt-[6px] space-y-[4px]">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-100 px-[10px] py-[6px] text-[12px]">
                <div className="flex items-center gap-[6px]">
                  <span className="font-medium text-slate-800">{s.subscriberName}</span>
                  {s.forced && <span className="rounded-full bg-slate-100 px-[6px] text-[10.5px] text-slate-500">Forced</span>}
                  {s.walked && <span className="rounded-full bg-indigo-50 px-[6px] text-[10.5px] text-indigo-600">Walked</span>}
                  <span className="ml-auto text-[11px] text-slate-400">{ago(s.at)}</span>
                </div>
                <p className="mt-[2px] truncate text-slate-500">{s.result}</p>
              </li>
            ))}
            {sessions.length === 0 && <li className="text-[12px] text-slate-500">No tests on this play yet.</li>}
          </ul>
        </section>
      </div>
    </aside>
  )
}
