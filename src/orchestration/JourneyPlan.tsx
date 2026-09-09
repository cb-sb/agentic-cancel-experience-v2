import { OFFER_VARIANTS, offerVariantLabel } from '../lib/offerVariants'
import { LIBRARY, setStepOffer, templateLabel } from '../journey/templates'
import type { AudienceKey, JourneyFile, OfferKey } from '../journey/types'
import { audienceLabel, useJourney } from '../store/useJourney'
import type { ShellLayout } from '../types/experience'

const AUDIENCES: AudienceKey[] = ['all', 'paying', 'high_value', 'high_risk', 'annual', 'in_trial']

const SHELLS: { id: ShellLayout; label: string; hint: string }[] = [
  { id: 'modal', label: 'Modal', hint: 'Overlay on the merchant site' },
  { id: 'fullpage', label: 'Full page', hint: 'Hosted cancel page' },
  { id: 'fullpage_scroll', label: 'Scrolling page', hint: 'Full page that scrolls' },
]

const OFFER_KEYS = OFFER_VARIANTS.map((v) => v.category as OfferKey)

export type PlanBeat = 'offers' | 'audience' | 'shell' | 'holdout' | 'brand' | 'review'

export function planBeats(file: JourneyFile): PlanBeat[] {
  const beats: PlanBeat[] = []
  if (file.steps.some((s) => s.kind === 'offer')) beats.push('offers')
  beats.push('audience', 'shell', 'holdout', 'brand', 'review')
  return beats
}

export function nextBeat(file: JourneyFile, current: PlanBeat): PlanBeat | null {
  const beats = planBeats(file)
  const i = beats.indexOf(current)
  return i < 0 ? beats[0] ?? null : (beats[i + 1] ?? null)
}

export function beatPrompt(beat: PlanBeat, file: JourneyFile): string {
  switch (beat) {
    case 'offers':
      return file.steps.filter((s) => s.kind === 'offer').length > 1
        ? 'These are the save mechanics on the path. Keep them unless you already know you want a pause, skip, or plan change.'
        : 'This is the save mechanic on the path. Keep it unless you already know you want a pause, skip, or plan change.'
    case 'audience':
      return 'This is for everyone who hits Cancel. Narrow it only if the save should hit a slice of the base.'
    case 'shell':
      return 'A modal sits on your site. A full page is the hosted cancel URL. Keep the overlay unless you already host a cancel page.'
    case 'holdout':
      return 'A holdout is a slice that skips this experience so you can measure lift. Leave it at none until you are ready to experiment.'
    case 'brand':
      return 'Name and color the subscriber sees. Defaults are Chargebee until you tint it.'
    case 'review':
      return 'Walk this as a subscriber to see if it’s right. Open any row on the plan to change a default — you don’t have to.'
  }
}

export function planIntro(file: JourneyFile): string {
  const label = templateLabel(file.template)
  if (file.kind === 'acquisition') {
    return `I’ve started ${label.toLowerCase()}. Defaults are in — walk it as a subscriber, or open a row on the plan to change who sees it or how it sits on the site.`
  }
  return `I’ve started ${label.toLowerCase()}. Defaults are in — walk it as a subscriber, or open a row on the plan to change who sees it, the offer, or how it sits on the site.`
}

function flowLine(file: JourneyFile): string {
  const entry = LIBRARY.find((e) => e.id === file.template)
  if (entry) return entry.stepLabels.join(' → ')
  const authored = file.steps.filter((s) => s.kind !== 'confirmation' && !s.kind.startsWith('outcome'))
  return authored.map((s) => s.kind.replace(/_/g, ' ')).join(' → ')
}

const AUDIENCE_HINT: Record<AudienceKey, string> = {
  all: 'Everyone who hits Cancel',
  paying: 'Only people currently paying',
  high_value: 'Top accounts — use a stronger save here',
  high_risk: 'Accounts that look likely to leave',
  annual: 'Yearly plans only',
  in_trial: 'Still in trial, not yet paying',
}

function beatHint(beat: PlanBeat): string | null {
  switch (beat) {
    case 'offers':
      return 'The subscriber sees this instead of leaving. Discount is the default; swap the mechanic if you already sell pause or a cheaper plan.'
    case 'audience':
      return 'Leave this on all subscribers unless this save is only for a segment.'
    case 'shell':
      return 'Most merchants start with a modal overlay on the account page.'
    case 'holdout':
      return 'Skip this until you want a control group. Zero means everyone sees the experience.'
    case 'brand':
      return 'Enough to preview. Fine-tune copy on the canvas.'
    default:
      return null
  }
}

function shellLabel(id: ShellLayout): string {
  return SHELLS.find((s) => s.id === id)?.label ?? id
}

function offerLine(file: JourneyFile): string {
  return file.steps
    .filter((s) => s.kind === 'offer')
    .map((s) => offerVariantLabel(s.offer ?? 'discount'))
    .join(', ')
}

/**
 * Live recap in the thread. Rows jump back to that question so the plan stays
 * a chat object, not a settings panel.
 */
export function PlanSummary({
  beat,
  onJump,
}: {
  beat?: PlanBeat
  onJump: (beat: PlanBeat) => void
}) {
  const file = useJourney((s) => s.file)
  const hasOffers = file.steps.some((s) => s.kind === 'offer')

  const rows: { beat: PlanBeat | null; label: string; value: string }[] = [
    { beat: null, label: 'Flow', value: flowLine(file) || templateLabel(file.template) },
    ...(hasOffers ? [{ beat: 'offers' as const, label: 'Offers', value: offerLine(file) || '—' }] : []),
    { beat: 'audience', label: 'Audience', value: audienceLabel(file.audience) },
    { beat: 'shell', label: 'Shell', value: shellLabel(file.shell) },
    {
      beat: 'holdout',
      label: 'Holdout',
      value: file.holdout === 0 ? 'Everyone in treatment' : `${file.holdout}% see nothing`,
    },
    {
      beat: 'brand',
      label: 'Brand',
      value: `${file.brand.merchant} · ${file.brand.primary.toUpperCase()}`,
    },
  ]

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Draft plan</div>
        <div className="mt-0.5 text-[13px] font-bold text-slate-900">{file.name}</div>
        <div className="text-[11px] text-slate-500">{templateLabel(file.template)}</div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) =>
          row.beat ? (
            <button
              key={row.label}
              type="button"
              onClick={() => onJump(row.beat!)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${
                beat === row.beat ? 'bg-slate-50' : ''
              }`}
            >
              <span className="w-16 flex-none text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {row.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium capitalize text-slate-800">
                {row.value}
              </span>
              <span className="flex-none text-[11px] font-semibold text-indigo-600">Edit</span>
            </button>
          ) : (
            <div key={row.label} className="flex items-center gap-3 px-3 py-2">
              <span className="w-16 flex-none text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {row.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium capitalize text-slate-800">
                {row.value}
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  )
}

/** One parameter’s controls — the only extra UI for the current Copilot turn. */
export function PlanBeatCard({
  beat,
  onContinue,
  onPreview,
  onConfirm,
  onKeepDefaults,
}: {
  beat: PlanBeat
  onContinue: (said: string) => void
  onPreview: () => void
  onConfirm: () => void
  onKeepDefaults: () => void
}) {
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const patchFile = useJourney((s) => s.patchFile)
  const offerSteps = file.steps.filter((s) => s.kind === 'offer')

  if (beat === 'review') {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={onPreview}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-[13px] font-bold text-white hover:bg-slate-800"
        >
          Walk this as a subscriber
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Looks good — I’m done for now
        </button>
      </div>
    )
  }

  const hint = beatHint(beat)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {hint && <p className="mb-3 text-[12px] leading-relaxed text-slate-500">{hint}</p>}
      {beat === 'offers' && (
        <div className="space-y-1.5">
          {offerSteps.map((step, i) => (
            <select
              key={step.id}
              value={step.offer ?? 'discount'}
              onChange={(e) =>
                replaceFile({
                  ...file,
                  steps: setStepOffer(file.steps, step.id, e.target.value as OfferKey),
                })
              }
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 outline-none hover:border-slate-300 focus:border-slate-400"
            >
              {OFFER_KEYS.map((key) => (
                <option key={key} value={key}>
                  {offerSteps.length > 1 ? `Offer ${i + 1}: ` : ''}
                  {offerVariantLabel(key)}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {beat === 'audience' && (
        <div className="space-y-2">
          {AUDIENCES.map((id) => (
            <Choice
              key={id}
              label={audienceLabel(id)}
              hint={AUDIENCE_HINT[id]}
              selected={file.audience === id}
              onClick={() => {
                patchFile({ audience: id })
                onContinue(audienceLabel(id))
              }}
            />
          ))}
        </div>
      )}

      {beat === 'shell' && (
        <div className="space-y-2">
          {SHELLS.map((s) => (
            <Choice
              key={s.id}
              label={s.label}
              hint={s.hint}
              selected={file.shell === s.id}
              onClick={() => {
                patchFile({ shell: s.id })
                onContinue(s.label)
              }}
            />
          ))}
        </div>
      )}

      {beat === 'holdout' && (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-slate-600">Holdout</span>
            <span className="text-[11px] tabular-nums text-slate-400">
              {file.holdout === 0 ? 'None' : `${file.holdout}%`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={file.holdout}
            onChange={(e) => patchFile({ holdout: Number(e.target.value) })}
            className="mt-1 w-full accent-slate-800"
          />
        </div>
      )}

      {beat === 'brand' && (
        <div className="space-y-3">
          <input
            value={file.brand.merchant}
            onChange={(e) => patchFile({ brand: { ...file.brand, merchant: e.target.value } })}
            placeholder="Merchant name"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-slate-400"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-slate-600">Primary color</span>
            <div className="flex overflow-hidden rounded-xl border border-slate-200">
              <label className="relative block h-9 w-9 cursor-pointer" style={{ background: file.brand.primary }}>
                <input
                  type="color"
                  value={file.brand.primary}
                  onChange={(e) => patchFile({ brand: { ...file.brand, primary: e.target.value } })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <input
                value={file.brand.primary.toUpperCase()}
                onChange={(e) => patchFile({ brand: { ...file.brand, primary: e.target.value } })}
                spellCheck={false}
                className="w-[90px] border-l border-slate-200 px-2 py-1.5 text-[12px] uppercase text-slate-600 outline-none"
              />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-slate-600">Corner radius</span>
              <span className="text-[11px] tabular-nums text-slate-400">{file.brand.corners}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={file.brand.corners}
              onChange={(e) => patchFile({ brand: { ...file.brand, corners: Number(e.target.value) } })}
              className="mt-1 w-full accent-slate-800"
            />
          </div>
        </div>
      )}

      {beat !== 'audience' && beat !== 'shell' && (
        <button
          type="button"
          onClick={() => onContinue(keepLabel(beat, file))}
          className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800"
        >
          {keepLabel(beat, file)}
        </button>
      )}
      <button
        type="button"
        onClick={onKeepDefaults}
        className="mt-2 w-full rounded-xl px-3 py-2 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      >
        Keep defaults and walk it
      </button>
    </div>
  )
}

function keepLabel(beat: PlanBeat, file: JourneyFile): string {
  switch (beat) {
    case 'offers':
      return `Keep ${offerLine(file) || 'this offer'}`
    case 'holdout':
      return file.holdout === 0 ? 'No holdout' : `Hold out ${file.holdout}%`
    case 'brand':
      return `Use ${file.brand.merchant}`
    default:
      return 'Continue'
  }
}

function Choice({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string
  hint?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
      }`}
    >
      <div className="text-[13px] font-medium">{label}</div>
      {hint && <div className={`mt-0.5 text-[11.5px] ${selected ? 'text-white/70' : 'text-slate-500'}`}>{hint}</div>}
    </button>
  )
}
