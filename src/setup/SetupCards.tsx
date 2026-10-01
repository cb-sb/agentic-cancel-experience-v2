import { useEffect, useState, type ReactNode } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { MatchSiteCard } from '../brand/MatchSiteCard'
import { setStepOffer } from '../journey/templates'
import type { AfterAccept, AnswerPassing, CancelProcessing, CancelTiming, OfferFulfilment, OfferKey } from '../journey/types'
import { OFFER_VARIANTS, offerVariantLabel } from '../lib/offerVariants'
import { SHELLS } from '../orchestration/JourneyPlan'
import { savedAudience, addToPlay, evenWeights, rankedPlays, renamePlay, setPlayLive, setSplitBy, setVariant, updatePlay, usePlays } from '../plays/usePlays'
import { ALL_AUDIENCE, LANGUAGES, variantLetter, type CancelPlay } from '../plays/types'
import { useJourney } from '../store/useJourney'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { AUDIENCE_LIBRARY, conditionExpression, type Audience } from '../types/orchestration'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { orderedThreads, setWorkspaceInstall, useWorkspace } from '../workspace/useWorkspace'
import { entryById, WORKSPACE_TARGET, type SetupEntry } from './registry'
import { patchWorkspaceSetup, setMark, useSetupState, type DoneBy } from './useSetupState'

export type CardMode = 'chat' | 'summary'

/** What the card says back in the chat once it's saved. */
export type Said = string

const OFFER_KEYS = OFFER_VARIANTS.map((v) => v.category as OfferKey)

const FULFILMENT: { id: OfferFulfilment; label: string; hint: string; target?: string }[] = [
  { id: 'billing', label: 'Billing applies it', hint: 'Chargebee, Stripe, Recurly or Recharge updates the subscription' },
  { id: 'url', label: 'Send them to a page', hint: 'You apply it on your side', target: 'https://yoursite.com/offer' },
  { id: 'webhook', label: 'Call a webhook', hint: 'Your system gets an event and applies it', target: 'https://api.yoursite.com/hooks/offer' },
  { id: 'email', label: 'Email your team', hint: 'Someone applies it by hand', target: 'retention@yoursite.com' },
]

const AFTER_ACCEPT: { id: AfterAccept; label: string; hint: string }[] = [
  { id: 'confirmation', label: 'Show a thank-you', hint: 'Confirms what they just got' },
  { id: 'feedback', label: 'Ask one quick question', hint: 'Why this offer worked for them' },
  { id: 'dismiss', label: 'Just close', hint: 'Straight back to your page' },
]

const PROCESSING: { id: CancelProcessing; label: string; hint: string }[] = [
  { id: 'billing_api', label: 'Process through billing', hint: 'The cancel goes through your billing system' },
  { id: 'override', label: 'Hand it to you', hint: 'Your email, page or webhook handles the cancel' },
]

const TIMING: { id: CancelTiming; label: string; hint: string }[] = [
  { id: 'immediate', label: 'Right away', hint: 'Access ends the moment they confirm' },
  { id: 'end_of_term', label: 'End of the current term', hint: 'They keep access until the term ends' },
  { id: 'end_of_billing_term', label: 'End of the billing period', hint: 'They keep access until the paid period ends' },
]

const PASSING: { id: AnswerPassing; label: string; hint: string }[] = [
  { id: 'hash', label: 'After a #', hint: 'yoursite.com/account#reason=price' },
  { id: 'query', label: 'As a query', hint: 'yoursite.com/account?reason=price' },
]

const SAVE_WINDOWS: { id: string; label: string }[] = [
  { id: '', label: 'No window' },
  { id: '7', label: '7 days' },
  { id: '14', label: '14 days' },
  { id: '30', label: '30 days' },
  { id: '60', label: '60 days' },
  { id: '90', label: '90 days' },
]

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none placeholder:text-slate-300 hover:border-slate-300 focus:border-slate-400'

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-[6px] text-[11px] font-bold uppercase tracking-wide text-slate-400">{children}</div>
}

function Choice({ label, hint, selected, onClick }: { label: string; hint?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
        selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
      }`}
    >
      <div className="text-[13px] font-medium">{label}</div>
      {hint && <div className={`mt-0.5 text-[11.5px] ${selected ? 'text-white/70' : 'text-slate-500'}`}>{hint}</div>}
    </button>
  )
}

/** Keeps its own text while typing and hands it up on blur or Enter. */
function Field({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
  type?: 'text' | 'url' | 'email'
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <label className="block">
      <span className="text-[11.5px] font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() !== value && onChange(v.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className={`mt-1 ${inputCls}`}
      />
    </label>
  )
}

function audienceKey(a: Audience): string {
  if (a.targetAll) return 'all'
  return a.savedAudienceId ?? 'custom'
}

function audienceFromKey(key: string): Audience {
  return key === 'all' ? ALL_AUDIENCE : savedAudience(key)
}

export function AudiencePicker({ value, onChange, allowEveryoneElse }: { value: Audience | undefined; onChange: (a: Audience | undefined) => void; allowEveryoneElse?: boolean }) {
  return (
    <select
      value={value ? audienceKey(value) : ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : audienceFromKey(e.target.value))}
      className={inputCls}
    >
      {allowEveryoneElse && <option value="">Everyone else</option>}
      {!allowEveryoneElse && <option value="all">All subscribers</option>}
      {AUDIENCE_LIBRARY.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
      {value && audienceKey(value) === 'custom' && <option value="custom">{value.name || 'Custom rules'}</option>}
    </select>
  )
}

interface CardProps {
  entry: SetupEntry
  targetId: string
  mode: CardMode
}

/** The fields for one experience setting. They edit the open experience's journey file. */
function ExperienceFields({ id }: { id: string }) {
  const file = useJourney((s) => s.file)
  const patchFile = useJourney((s) => s.patchFile)
  const replaceFile = useJourney((s) => s.replaceFile)
  const updateStep = useJourney((s) => s.updateStep)
  const updateCancelHandling = useJourney((s) => s.updateCancelHandling)
  const compiled = useExperience((s) => s.experience.steps)
  const offers = file.steps.filter((s) => s.kind === 'offer')
  const ch = file.cancelHandling ?? {}
  const multi = offers.length > 1

  switch (id) {
    case 'layout':
      return (
        <div className="space-y-[6px]">
          {SHELLS.map((s) => (
            <Choice key={s.id} label={s.label} hint={s.hint} selected={file.shell === s.id} onClick={() => patchFile({ shell: s.id })} />
          ))}
        </div>
      )
    case 'offers':
      return (
        <div className="space-y-[6px]">
          {offers.map((step, i) => (
            <select
              key={step.id}
              value={step.offer ?? 'discount'}
              onChange={(e) => replaceFile({ ...file, steps: setStepOffer(file.steps, step.id, e.target.value as OfferKey) })}
              className={inputCls}
            >
              {OFFER_KEYS.map((key) => (
                <option key={key} value={key}>
                  {multi ? `Offer ${i + 1}: ` : ''}
                  {offerVariantLabel(key)}
                </option>
              ))}
            </select>
          ))}
        </div>
      )
    case 'fulfilment':
      return (
        <div className="space-y-[14px]">
          {offers.map((step, i) => {
            const pick = FULFILMENT.find((f) => f.id === step.fulfilment)
            return (
              <div key={step.id}>
                <Label>{multi ? `Offer ${i + 1}, ${offerVariantLabel(step.offer ?? 'discount')}` : offerVariantLabel(step.offer ?? 'discount')}</Label>
                <div className="grid grid-cols-2 gap-[6px]">
                  {FULFILMENT.map((f) => (
                    <Choice key={f.id} label={f.label} hint={f.hint} selected={step.fulfilment === f.id} onClick={() => updateStep(step.id, { fulfilment: f.id })} />
                  ))}
                </div>
                {pick?.target && (
                  <div className="mt-[8px]">
                    <Field
                      label={pick.id === 'email' ? 'Email address' : 'URL'}
                      type={pick.id === 'email' ? 'email' : 'url'}
                      placeholder={pick.target}
                      value={step.fulfilmentTarget ?? ''}
                      onChange={(v) => updateStep(step.id, { fulfilmentTarget: v })}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    case 'afterAccept':
      return (
        <div className="space-y-[14px]">
          {offers.map((step, i) => (
            <div key={step.id}>
              {multi && <Label>{`Offer ${i + 1}, ${offerVariantLabel(step.offer ?? 'discount')}`}</Label>}
              <div className="space-y-[6px]">
                {AFTER_ACCEPT.map((a) => (
                  <Choice key={a.id} label={a.label} hint={a.hint} selected={step.afterAccept === a.id} onClick={() => updateStep(step.id, { afterAccept: a.id })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    case 'reasons': {
      const survey = file.steps.find((s) => s.kind === 'survey')
      if (!survey) return null
      const fromCompiled =
        compiled
          .find((c) => c.id === survey.id)
          ?.components.flatMap((c) => (c.kind === 'survey' ? c.options.filter((o) => !o.isOther).map((o) => o.label) : [])) ?? []
      const reasons = survey.content?.surveyReasons ?? fromCompiled
      return <ReasonList reasons={reasons} onChange={(next) => updateStep(survey.id, { content: { surveyReasons: next } })} />
    }
    case 'buttonLinks':
      return (
        <div className="space-y-[8px]">
          <Field label="Never mind button" type="url" placeholder="https://app.yoursite.com/account" value={ch.nevermindUrl ?? ''} onChange={(v) => updateCancelHandling({ nevermindUrl: v })} />
          <Field label="Cancel button, once they confirm" type="url" placeholder="https://yoursite.com/goodbye" value={ch.cancelUrl ?? ''} onChange={(v) => updateCancelHandling({ cancelUrl: v })} />
        </div>
      )
    case 'returnUrls':
      return (
        <div className="space-y-[8px]">
          <Field label="After they accept an offer and stay" type="url" placeholder="https://app.yoursite.com/account?saved=1" value={ch.saveReturnUrl ?? ''} onChange={(v) => updateCancelHandling({ saveReturnUrl: v })} />
          <Field label="After the cancel is confirmed" type="url" placeholder="https://yoursite.com/cancelled" value={ch.confirmationUrl ?? ''} onChange={(v) => updateCancelHandling({ confirmationUrl: v })} />
        </div>
      )
    case 'answerPassing':
      return (
        <div className="space-y-[6px]">
          {PASSING.map((p) => (
            <Choice key={p.id} label={p.label} hint={p.hint} selected={ch.answerPassing === p.id} onClick={() => updateCancelHandling({ answerPassing: p.id })} />
          ))}
        </div>
      )
    case 'cancelHandling':
      return (
        <div className="space-y-[12px]">
          <div>
            <Label>How it's processed</Label>
            <div className="space-y-[6px]">
              {PROCESSING.map((o) => (
                <Choice key={o.id} label={o.label} hint={o.hint} selected={ch.processing === o.id} onClick={() => updateCancelHandling({ processing: o.id })} />
              ))}
            </div>
          </div>
          <div>
            <Label>When it takes effect</Label>
            <div className="space-y-[6px]">
              {TIMING.map((o) => (
                <Choice key={o.id} label={o.label} hint={o.hint} selected={ch.timing === o.id} onClick={() => updateCancelHandling({ timing: o.id })} />
              ))}
            </div>
          </div>
        </div>
      )
    case 'brand':
      return <MatchSiteCard compact onMatched={() => undefined} />
    default:
      return null
  }
}

function ReasonList({ reasons, onChange }: { reasons: string[]; onChange: (next: string[]) => void }) {
  const [rows, setRows] = useState(reasons)
  useEffect(() => setRows(reasons), [reasons])
  const commit = (next: string[]) => {
    const clean = next.map((r) => r.trim()).filter(Boolean)
    if (clean.join('|') !== reasons.join('|')) onChange(clean)
  }
  return (
    <div className="space-y-[6px]">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-[6px]">
          <input
            value={r}
            onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
            onBlur={() => commit(rows)}
            className={inputCls}
          />
          <button
            type="button"
            aria-label="Remove reason"
            onClick={() => {
              const next = rows.filter((_, j) => j !== i)
              setRows(next)
              commit(next)
            }}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <SIcon name="x" size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((x) => [...x, ''])}
        className="inline-flex items-center gap-[5px] rounded-lg px-[8px] py-[5px] text-[12px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <SIcon name="plus" size={12} /> Add a reason
      </button>
    </div>
  )
}

/** The fields for one play setting. */
function PlayFields({ id, play }: { id: string; play: CancelPlay }) {
  const threads = useWorkspace((s) => s.threads)
  const priority = useCancelSettings((s) => s.priority)
  const plays = usePlays((s) => s.plays)
  const [nameError, setNameError] = useState<string | null>(null)
  const title = (expId: string) => threads.find((t) => t.id === expId)?.title ?? 'Experience'

  switch (id) {
    case 'playName':
      return (
        <div>
          <Field label="Play name" value={play.name} onChange={(v) => setNameError(renamePlay(play.id, v))} />
          {nameError && <p className="mt-[4px] text-[12px] text-rose-600">{nameError}</p>}
        </div>
      )
    case 'audience':
      return (
        <div className="space-y-[6px]">
          <Choice label="All subscribers" hint="Everyone who clicks Cancel" selected={Boolean(play.audience.targetAll)} onClick={() => updatePlay(play.id, { audience: ALL_AUDIENCE })} />
          {AUDIENCE_LIBRARY.map((a) => (
            <Choice
              key={a.id}
              label={a.name}
              hint={conditionExpression(a.conditions, a.match)}
              selected={play.audience.savedAudienceId === a.id}
              onClick={() => updatePlay(play.id, { audience: savedAudience(a.id) })}
            />
          ))}
        </div>
      )
    case 'variants': {
      const free = orderedThreads(threads).filter((t) => !play.variants.some((v) => v.experienceId === t.id))
      return (
        <div className="space-y-[8px]">
          {play.variants.map((v, i) => (
            <div key={v.id} className="flex items-center gap-[8px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]">
              <span className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">{variantLetter(i)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-800">{title(v.experienceId)}</span>
            </div>
          ))}
          {free.length > 0 && (
            <select value="" onChange={(e) => e.target.value && addToPlay(play.id, e.target.value)} className={inputCls}>
              <option value="">Add an experience…</option>
              {free.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
        </div>
      )
    }
    case 'split': {
      const total = play.variants.reduce((a, v) => a + v.weight, 0)
      return (
        <div className="space-y-[10px]">
          <div className="grid grid-cols-2 gap-[6px]">
            <Choice label="By percentage" hint="An A/B test" selected={play.splitBy === 'percent'} onClick={() => setSplitBy(play.id, 'percent')} />
            <Choice label="By sub-audience" hint="Each group gets its own" selected={play.splitBy === 'segments'} onClick={() => setSplitBy(play.id, 'segments')} />
          </div>
          {play.splitBy === 'percent' ? (
            <div className="space-y-[6px]">
              {play.variants.map((v, i) => (
                <label key={v.id} className="flex items-center gap-[8px] text-[13px]">
                  <span className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">{variantLetter(i)}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{title(v.experienceId)}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={v.weight}
                    onChange={(e) => setVariant(play.id, v.id, { weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    className="w-[64px] rounded-lg border border-slate-200 px-[8px] py-[4px] text-right text-[13px] tabular-nums outline-none focus:border-slate-400"
                  />
                  <span className="text-slate-400">%</span>
                </label>
              ))}
              <div className="flex items-center justify-between text-[12px]">
                <span className={total === 100 ? 'text-slate-400' : 'font-medium text-rose-600'}>{total === 100 ? 'Adds up to 100%' : `Adds up to ${total}%. Make it 100%.`}</span>
                <button type="button" onClick={() => updatePlay(play.id, { variants: evenWeights(play.variants) })} className="font-semibold text-indigo-600 hover:underline">
                  Split evenly
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-[8px]">
              {play.variants.map((v, i) => (
                <div key={v.id}>
                  <div className="mb-[4px] flex items-center gap-[6px] text-[12.5px] text-slate-600">
                    <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md bg-slate-100 text-[10.5px] font-bold text-slate-600">{variantLetter(i)}</span>
                    <span className="truncate">{title(v.experienceId)}</span>
                  </div>
                  <AudiencePicker value={v.audience} allowEveryoneElse onChange={(a) => setVariant(play.id, v.id, { audience: a })} />
                </div>
              ))}
              {!play.variants.some((v) => !v.audience) && (
                <p className="text-[12px] text-amber-700">Pick one variant for Everyone else, so nobody falls through.</p>
              )}
            </div>
          )}
        </div>
      )
    }
    case 'control':
      return (
        <div>
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="text-slate-600">Control group</span>
            <span className="tabular-nums text-slate-500">{play.control === 0 ? 'Off' : `${play.control}%`}</span>
          </div>
          <input type="range" min={0} max={50} step={5} value={play.control} onChange={(e) => updatePlay(play.id, { control: Number(e.target.value) })} className="mt-1 w-full accent-slate-800" />
          <p className="mt-[4px] text-[12px] text-slate-500">
            {play.control === 0 ? 'Everyone in the audience gets a cancel page.' : `${play.control}% of this play's audience cancels with no cancel page, so you can measure the lift.`}
          </p>
        </div>
      )
    case 'priority': {
      const ranked = rankedPlays(plays, priority)
      const move = (from: number, to: number) => {
        const ids = ranked.map((p) => p.id)
        const [x] = ids.splice(from, 1)
        ids.splice(to, 0, x)
        useCancelSettings.getState().setPriority(ids)
      }
      return (
        <div className="space-y-[4px]">
          {ranked.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-[8px] rounded-xl border px-3 py-[6px] text-[13px] ${p.id === play.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}
            >
              <span className="w-[16px] flex-none text-[12px] tabular-nums text-slate-400">{i + 1}</span>
              <span className={`min-w-0 flex-1 truncate ${p.id === play.id ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{p.name}</span>
              <button type="button" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-[2px] text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <SIcon name="chevron-up" size={13} />
              </button>
              <button type="button" aria-label={`Move ${p.name} down`} disabled={i === ranked.length - 1} onClick={() => move(i, i + 1)} className="rounded p-[2px] text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <SIcon name="chevron-down" size={13} />
              </button>
            </div>
          ))}
          <p className="pt-[2px] text-[12px] text-slate-500">When two plays match the same person, the higher one wins.</p>
        </div>
      )
    }
    case 'language':
      return (
        <select value={play.language} onChange={(e) => updatePlay(play.id, { language: e.target.value })} className={inputCls}>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      )
    case 'saveWindow':
      return (
        <select
          value={play.saveWindowDays === null ? '' : String(play.saveWindowDays)}
          onChange={(e) => updatePlay(play.id, { saveWindowDays: e.target.value ? Number(e.target.value) : null })}
          className={inputCls}
        >
          {SAVE_WINDOWS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      )
    default:
      return null
  }
}

function WorkspaceFields({ id }: { id: string }) {
  const ws = useSetupState((s) => s.workspace)
  const connected = useWorkspace((s) => s.installConnected)
  switch (id) {
    case 'install':
      return (
        <div className="flex items-center gap-[10px] rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className={`h-[8px] w-[8px] flex-none rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span className="min-w-0 flex-1 text-[13px] text-slate-700">{connected ? 'Billing is connected and the snippet is in place' : 'Not connected yet'}</span>
          <SButton size="small" variant={connected ? 'neutral-outline' : 'primary'} className="w-auto" onClick={() => setWorkspaceInstall(!connected)}>
            {connected ? 'Disconnect' : 'Connect'}
          </SButton>
        </div>
      )
    case 'domain':
      return <Field label="Domain" placeholder="cancel.yoursite.com" value={ws.customDomain} onChange={(v) => patchWorkspaceSetup({ customDomain: v })} />
    case 'alerts':
      return (
        <div className="space-y-[8px]">
          <Field label="Email" type="email" placeholder="team@yoursite.com" value={ws.alertEmail} onChange={(v) => patchWorkspaceSetup({ alertEmail: v })} />
          <Field label="Slack channel" placeholder="#retention" value={ws.alertSlack} onChange={(v) => patchWorkspaceSetup({ alertSlack: v })} />
          <Field label="Webhook" type="url" placeholder="https://api.yoursite.com/hooks/cancel" value={ws.alertWebhook} onChange={(v) => patchWorkspaceSetup({ alertWebhook: v })} />
        </div>
      )
    default:
      return null
  }
}

/** One line for the chat after a card is saved. */
export function savedLine(id: string, targetId: string): Said {
  const file = useJourney.getState().file
  const ch = file.cancelHandling ?? {}
  const play = usePlays.getState().plays.find((p) => p.id === targetId)
  const offers = file.steps.filter((s) => s.kind === 'offer')
  switch (id) {
    case 'layout':
      return `Use a ${SHELLS.find((s) => s.id === file.shell)?.label.toLowerCase() ?? 'modal'}`
    case 'offers':
      return `Keep ${offers.map((s) => offerVariantLabel(s.offer ?? 'discount')).join(', ')}`
    case 'fulfilment':
      return offers.map((s) => `${offerVariantLabel(s.offer ?? 'discount')}: ${FULFILMENT.find((f) => f.id === s.fulfilment)?.label.toLowerCase() ?? 'not set'}`).join(', ')
    case 'afterAccept':
      return offers.map((s) => AFTER_ACCEPT.find((a) => a.id === s.afterAccept)?.label ?? 'Not set').join(', ')
    case 'buttonLinks':
      return ch.nevermindUrl || ch.cancelUrl
        ? [ch.nevermindUrl && `Never mind goes to ${ch.nevermindUrl}`, ch.cancelUrl && `Cancel goes to ${ch.cancelUrl}`].filter(Boolean).join(', ')
        : 'Use the default button links'
    case 'returnUrls':
      return ch.saveReturnUrl || ch.confirmationUrl
        ? [ch.saveReturnUrl && `Stayed: ${ch.saveReturnUrl}`, ch.confirmationUrl && `Cancelled: ${ch.confirmationUrl}`].filter(Boolean).join(', ')
        : 'Use the default return pages'
    case 'answerPassing':
      return `Pass answers ${ch.answerPassing === 'query' ? 'as a query' : 'after a #'}`
    case 'cancelHandling': {
      const p = PROCESSING.find((o) => o.id === ch.processing)?.label
      const t = TIMING.find((o) => o.id === ch.timing)?.label.toLowerCase()
      return p && t ? `${p}, ${t}` : 'Set cancel handling'
    }
    case 'reasons': {
      const reasons = file.steps.find((s) => s.kind === 'survey')?.content?.surveyReasons
      return reasons?.length ? `Use these reasons: ${reasons.join(', ')}` : 'These reasons look right'
    }
    case 'brand':
      return `Use ${file.brand.merchant}, ${file.brand.primary.toUpperCase()}`
    case 'playName':
      return play ? `Call it ${play.name}` : 'Name it'
    case 'audience':
      return play ? `Show it to ${play.audience.targetAll ? 'all subscribers' : play.audience.name.toLowerCase()}` : 'Set the audience'
    case 'variants':
      return play ? `${play.variants.length} variant${play.variants.length === 1 ? '' : 's'}` : 'Set the variants'
    case 'split':
      return play?.splitBy === 'segments' ? 'Split by sub-audience' : `Split ${play?.variants.map((v) => `${v.weight}%`).join(' / ')}`
    case 'control':
      return play && play.control > 0 ? `Hold back ${play.control}%` : 'No control group'
    case 'priority':
      return 'The play order looks right'
    case 'language':
      return `Show it in ${LANGUAGES.find((l) => l.id === play?.language)?.label ?? 'English'}`
    case 'saveWindow':
      return play?.saveWindowDays ? `Leave saved people alone for ${play.saveWindowDays} days` : 'No save window'
    case 'install':
      return 'Billing and install are connected'
    case 'domain':
      return useSetupState.getState().workspace.customDomain ? `Use ${useSetupState.getState().workspace.customDomain}` : 'No custom domain for now'
    case 'alerts': {
      const ws = useSetupState.getState().workspace
      const on = [ws.alertEmail && `email ${ws.alertEmail}`, ws.alertSlack && `Slack ${ws.alertSlack}`, ws.alertWebhook && 'a webhook'].filter(Boolean)
      return on.length ? `Send alerts to ${on.join(', ')}` : 'No alerts for now'
    }
    default:
      return 'Done'
  }
}

/** What still has to be picked before Save means anything. Null when it can be saved. */
function missing(id: string, targetId: string, file: ReturnType<typeof useJourney.getState>['file'], plays: CancelPlay[]): string | null {
  const offers = file.steps.filter((s) => s.kind === 'offer')
  const ch = file.cancelHandling ?? {}
  const play = plays.find((p) => p.id === targetId)
  switch (id) {
    case 'fulfilment':
      if (offers.some((s) => !s.fulfilment)) return offers.length > 1 ? 'Pick one for each offer' : 'Pick one'
      if (offers.some((s) => s.fulfilment !== 'billing' && !s.fulfilmentTarget?.trim())) return 'Add where it goes'
      return null
    case 'afterAccept':
      return offers.some((s) => !s.afterAccept) ? (offers.length > 1 ? 'Pick one for each offer' : 'Pick one') : null
    case 'cancelHandling':
      return ch.processing && ch.timing ? null : 'Pick both'
    case 'answerPassing':
      return ch.answerPassing ? null : 'Pick one'
    case 'split':
      if (!play) return null
      if (play.splitBy === 'percent') return play.variants.reduce((a, v) => a + v.weight, 0) === 100 ? null : 'Make it add up to 100%'
      return play.variants.some((v) => !v.audience) ? null : 'Pick one for Everyone else'
    default:
      return null
  }
}

/** Items that are finished by pressing a button instead of filling a field. */
function ActionFields({ id, targetId }: { id: string; targetId: string }) {
  const live = useOrchestration((s) => s.play.publishState === 'live')
  const play = usePlays((s) => s.plays.find((p) => p.id === targetId))
  if (id === 'publish') {
    return (
      <div className="flex items-center gap-[10px] rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className={`h-[8px] w-[8px] flex-none rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <span className="min-w-0 flex-1 text-[13px] text-slate-700">{live ? 'This experience is published' : 'Draft'}</span>
        {!live && (
          <SButton size="small" variant="primary" className="w-auto" onClick={() => useOrchestration.getState().togglePublish()}>
            Publish
          </SButton>
        )}
      </div>
    )
  }
  if (id === 'goLive' && play) {
    return (
      <div className="flex items-center gap-[10px] rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className={`h-[8px] w-[8px] flex-none rounded-full ${play.status === 'live' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <span className="min-w-0 flex-1 text-[13px] text-slate-700">{play.status === 'live' ? 'The play is live' : 'Draft'}</span>
        <SButton size="small" variant={play.status === 'live' ? 'neutral-outline' : 'primary'} className="w-auto" onClick={() => setPlayLive(play.id, play.status !== 'live')}>
          {play.status === 'live' ? 'Pause play' : 'Go live'}
        </SButton>
      </div>
    )
  }
  return null
}

export function SetupFields({ entry, targetId }: { entry: SetupEntry; targetId: string }) {
  const play = usePlays((s) => s.plays.find((p) => p.id === targetId))
  if (entry.id === 'publish' || entry.id === 'goLive') return <ActionFields id={entry.id} targetId={targetId} />
  if (entry.scope === 'experience') return <ExperienceFields id={entry.id} />
  if (entry.scope === 'play') return play ? <PlayFields id={entry.id} play={play} /> : null
  return <WorkspaceFields id={entry.id} />
}

/** Has fields the merchant can fill right here. The rest point somewhere else. */
export function hasFields(entry: SetupEntry): boolean {
  return entry.chat && entry.id !== 'variantsReady'
}

/**
 * One setting as a card. In the chat it has Save, Skip for now and Not needed.
 * In the Summary the fields save as you go.
 */
export function SetupCard({
  entry,
  targetId,
  mode,
  onSave,
  onSkip,
  onNotNeeded,
  onShowMe,
}: CardProps & {
  onSave?: (said: Said) => void
  onSkip?: () => void
  onNotNeeded?: () => void
  onShowMe?: () => void
}) {
  const by: DoneBy = mode === 'chat' ? 'chat' : 'summary'
  const brandMatched = useJourney((s) => Boolean(s.file.brand.matched))
  const file = useJourney((s) => s.file)
  const plays = usePlays((s) => s.plays)
  const gap = missing(entry.id, targetId, file, plays)
  if (!hasFields(entry)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-[12.5px] leading-relaxed text-slate-600">{entry.why}. This one is done outside the chat.</p>
        <div className="mt-3 flex flex-wrap justify-end gap-[8px]">
          {onSkip && (
            <SButton size="small" variant="neutral-ghost" className="w-auto" onClick={onSkip}>
              Skip for now
            </SButton>
          )}
          {onShowMe && (
            <SButton size="small" variant="primary" className="w-auto" onClick={onShowMe}>
              Show me
            </SButton>
          )}
        </div>
      </div>
    )
  }
  const save = () => {
    setMark(entry.scope === 'workspace' ? WORKSPACE_TARGET : targetId, entry.id, 'done', by)
    onSave?.(savedLine(entry.id, targetId))
  }
  const actionOnly = entry.id === 'publish' || entry.id === 'goLive'
  return (
    <div className={mode === 'chat' ? 'rounded-2xl border border-slate-200 bg-white p-3 shadow-sm' : ''}>
      {mode === 'chat' && <p className="mb-3 text-[12px] leading-relaxed text-slate-500">{entry.why}.</p>}
      <SetupFields entry={entry} targetId={targetId} />
      {mode === 'chat' && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-[8px]">
          {gap && !actionOnly && <span className="mr-auto text-[12px] text-slate-400">{gap}</span>}
          {onNotNeeded && entry.level !== 'required' && (
            <SButton size="small" variant="neutral-ghost" className="w-auto" onClick={onNotNeeded}>
              Not needed
            </SButton>
          )}
          {onSkip && (
            <SButton size="small" variant="neutral-outline" className="w-auto" onClick={onSkip}>
              Skip for now
            </SButton>
          )}
          {!actionOnly && (
            <SButton
              size="small"
              variant="primary"
              className="w-auto"
              disabled={(entry.id === 'brand' && !brandMatched) || Boolean(gap)}
              onClick={save}
            >
              Save
            </SButton>
          )}
        </div>
      )}
      {mode === 'summary' && !actionOnly && !gap && (
        <div className="mt-[10px] flex justify-end">
          <button type="button" onClick={save} className="text-[12px] font-semibold text-indigo-600 hover:underline">
            Mark as done
          </button>
        </div>
      )}
    </div>
  )
}

export function entryFor(id: string): SetupEntry | undefined {
  return entryById(id)
}
