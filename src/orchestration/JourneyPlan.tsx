import { SButton } from '@chargebee/sting-react'
import { brandGatePrompt, isBrandMatched } from '../brand/matchSite'
import { MatchSiteCard } from '../brand/MatchSiteCard'
import { OFFER_VARIANTS, offerVariantLabel } from '../lib/offerVariants'
import { LIBRARY, setStepOffer, templateLabel } from '../journey/templates'
import { uploadedScreenChain } from '../journey/contextDoc'
import type {
  AudienceKey,
  CancelProcessing,
  CancelTiming,
  JourneyFile,
  OfferKey,
} from '../journey/types'
import { STUDIO, V8 } from '../layout/layoutMode'
import { audienceLabel, useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { audienceSummary } from '../types/orchestration'
import { SplitEditor, splitLine } from './targeting/SplitEditor'
import { useCancelSettings } from '../workspace/useCancelSettings'
import type { ShellLayout } from '../types/experience'

function CtaPair({
  primary,
  secondary,
}: {
  primary: { label: string; onClick: () => void }
  secondary: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-[8px]">
      <SButton size="small" variant="neutral-outline" className="w-auto shrink-0" onClick={secondary.onClick}>
        {secondary.label}
      </SButton>
      <SButton size="small" variant="primary" className="w-auto shrink-0" onClick={primary.onClick}>
        {primary.label}
      </SButton>
    </div>
  )
}

const KEEP_REST = V8 ? 'Keep the rest as is' : 'Keep defaults and walk it'

const AUDIENCES: AudienceKey[] = ['all', 'paying', 'high_value', 'high_risk', 'annual', 'in_trial']

export const SHELLS: { id: ShellLayout; label: string; hint: string }[] = V8
  ? [
      { id: 'modal', label: 'Modal', hint: 'Opens over your account page' },
      { id: 'fullpage', label: 'Full page', hint: 'Full viewport width, one step at a time' },
      { id: 'fullpage_scroll', label: 'Full page continuous', hint: 'Every step on one page that scrolls' },
    ]
  : [
      { id: 'modal', label: 'Modal', hint: 'Overlay on the merchant site' },
      { id: 'fullpage', label: 'Full page', hint: 'Hosted cancel page' },
      { id: 'fullpage_scroll', label: 'Scrolling page', hint: 'Full page that scrolls' },
    ]

const OFFER_KEYS = OFFER_VARIANTS.map((v) => v.category as OfferKey)

export type PlanBeat =
  | 'walk'
  | 'offers'
  | 'audience'
  | 'shell'
  | 'holdout'
  | 'brand'
  | 'cancel'
  | 'experiment'
  | 'tests'
  | 'review'
  | 'publish'

const PROCESSING_CHOICES: { id: CancelProcessing; label: string; hint: string }[] = [
  { id: 'billing_api', label: 'Process via Billing', hint: "Growth cancels through Chargebee's API." },
  { id: 'override', label: 'Override', hint: 'Hand off to your own email, URL, or webhook.' },
]

const TIMING_CHOICES: { id: CancelTiming; label: string; hint: string }[] = [
  { id: 'immediate', label: 'Immediately', hint: 'Cancel the moment it is confirmed.' },
  { id: 'end_of_term', label: 'End of current term', hint: 'Access continues until this term ends.' },
  { id: 'end_of_billing_term', label: 'End of billing term', hint: 'Cancel at the end of the paid cycle.' },
]

export function planBeats(file: JourneyFile): PlanBeat[] {
  const hasOffers = file.steps.some((s) => s.kind === 'offer')
  if (V8) {
    const beats: PlanBeat[] = hasOffers ? ['offers'] : []
    beats.push('audience', 'tests', 'shell', 'cancel', 'brand', 'publish')
    return beats
  }
  const beats: PlanBeat[] = ['walk']
  if (hasOffers) beats.push('offers')
  beats.push('audience', 'holdout', 'brand', 'publish')
  return beats
}

/** v8: the first thing Copilot sets up once screens are in. */
export function firstBeat(file: JourneyFile): PlanBeat {
  return planBeats(file)[0] ?? 'audience'
}

const V8_LAND_LINE =
  'Your screens are in, with sensible defaults. I’ll go through the settings with you one at a time. Skip anything you want to come back to. The Task list shows what’s left.'

/** v8: what Copilot says once screens land. The setup cards take it from there. */
export function v8Landing(file: JourneyFile): { beat: PlanBeat; text: string } {
  return { beat: firstBeat(file), text: V8_LAND_LINE }
}

export const SETUP_ONLY_REPLY =
  'Here I can set the offers, who sees it, tests, the page style, cancel handling and brand. To change screen text, use the Editor tab.'

/** v8: shortcuts to each setting Copilot handles. */
export function setupChips(file: JourneyFile): { beat: PlanBeat; label: string }[] {
  return [
    ...(file.steps.some((s) => s.kind === 'offer') ? [{ beat: 'offers' as const, label: 'Change the offers' }] : []),
    { beat: 'audience', label: 'Change who sees it' },
    { beat: 'tests', label: 'Set up a test' },
    { beat: 'shell', label: 'Change the page style' },
    { beat: 'cancel', label: 'Set cancel handling' },
    { beat: 'brand', label: 'Match my brand' },
  ]
}

function v8Prompt(beat: PlanBeat, file: JourneyFile): string | null {
  switch (beat) {
    case 'offers':
      return file.steps.filter((s) => s.kind === 'offer').length > 1
        ? 'Here are the offers on the path. Keep them, or pick different ones.'
        : 'Here’s the offer on the path. Keep it, or pick a different one.'
    case 'audience':
      return 'Who should see this cancel page? Everyone who clicks Cancel is the default.'
    case 'tests':
      return 'Show one page to everyone, test pages against each other, or give each sub-audience its own page.'
    case 'shell':
      return 'How should the page sit on your site? A modal opens over your account page. A full page is a hosted cancel URL.'
    case 'cancel':
      return 'When someone goes through with the cancel, how should it be handled? Pick how it’s processed and when it takes effect. Return URLs are optional.'
    case 'publish':
      return 'That’s the setup. Walk it in Preview if you want, then publish.'
    default:
      return null
  }
}

export function nextBeat(file: JourneyFile, current: PlanBeat): PlanBeat | null {
  const beats = planBeats(file)
  const i = beats.indexOf(current)
  const rest = i < 0 ? beats : beats.slice(i + 1)
  return rest.find((b) => b !== 'brand' || !isBrandMatched(file.brand)) ?? null
}

export function prevBeat(file: JourneyFile, current: PlanBeat): PlanBeat | null {
  const beats = planBeats(file)
  const i = beats.indexOf(current)
  if (i <= 0) return null
  return beats
    .slice(0, i)
    .reverse()
    .find((b) => b !== 'brand' || !isBrandMatched(file.brand)) ?? null
}

export function beatPrompt(beat: PlanBeat, file: JourneyFile): string {
  const v8 = V8 ? v8Prompt(beat, file) : null
  if (v8) return v8
  switch (beat) {
    case 'walk':
      return 'Walk this as a subscriber. Editor is optional — you can come back to a step from the canvas.'
    case 'offers':
      return file.steps.filter((s) => s.kind === 'offer').length > 1
        ? 'These are the save mechanics on the path. Keep them unless you already know you want a pause, skip, or plan change.'
        : 'This is the save mechanic on the path. Keep it unless you already know you want a pause, skip, or plan change.'
    case 'audience':
      return 'This is for everyone who hits Cancel. Narrow it only if the save should hit a slice of the base.'
    case 'shell':
      return 'A modal sits on your site. A full page is the hosted cancel URL. Keep the overlay unless you already host a cancel page.'
    case 'holdout':
      if (STUDIO) {
        return 'Cancel pages have no control group of their own. Chargebee holds out one share of everyone who clicks Cancel, across all cancel experiences, called Global control. You set it once in the cancel page settings on the Experiences page.'
      }
      return 'A holdout is a slice that skips this experience so you can measure lift. Leave it at none until you are ready to experiment.'
    case 'cancel':
      return 'How should the cancel be handled once someone goes through? Pick how it’s processed and when it takes effect. Return URLs are optional.'
    case 'experiment':
    case 'tests':
      return 'This play splits traffic to compare treatments. Check the split reads right — an offer variant against a no-offer control is the honest comparison.'
    case 'brand':
      return brandGatePrompt(file.kind)
    case 'review':
      return 'Walk this as a subscriber to see if it’s right. Open any row on the plan to change a default — you don’t have to.'
    case 'publish':
      return 'Publish when play setup, experience, and testing look right. Gaps stay listed — this prototype will still go live if you choose to.'
  }
}

export function planProposeIntro(file: JourneyFile): string {
  const chain = file.source === 'uploaded' ? uploadedScreenChain(file) : templateLabel(file.template)
  return `Here’s the path I’d start you on: ${chain}.\n\nThese are the screens a subscriber sees. Drag to change the order. Nothing is live. If this looks right, I’ll open the editor next. Copilot stays on the ${V8 ? 'right' : 'left'} for the rest.`
}

export function planCanvasIntro(): string {
  return `The editor is open on the first screen. Preview walks it as a subscriber. Canvas is there when you want the whole play. Copilot stays on the ${V8 ? 'right' : 'left'} for who sees it, holdout, and brand.`
}

export function planIntro(file: JourneyFile): string {
  if (file.source === 'uploaded') {
    const chain = uploadedScreenChain(file)
    return chain
      ? `This is the pack you uploaded (${chain}). Defaults are in — walk it as a subscriber, or open a row on the plan to change who sees it, holdout, or brand.`
      : 'This is the pack you uploaded. Defaults are in — walk it as a subscriber, or open a row on the plan to change who sees it, holdout, or brand.'
  }
  const label = templateLabel(file.template)
  if (file.kind === 'acquisition' || !file.steps.some((s) => s.kind === 'offer')) {
    return `I’ve started ${label.toLowerCase()}. Defaults are in — walk it as a subscriber, or open a row on the plan to change who sees it or how it sits on the site.`
  }
  return `I’ve started ${label.toLowerCase()}. Defaults are in — walk it as a subscriber, or open a row on the plan to change who sees it, the offer, or how it sits on the site.`
}

export function flowLine(file: JourneyFile): string {
  if (file.source === 'uploaded') return uploadedScreenChain(file)
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
      return STUDIO ? null : 'Skip this until you want a control group. Zero means everyone sees the experience.'
    case 'brand':
      return null
    default:
      return null
  }
}

export function shellLabel(id: ShellLayout): string {
  return SHELLS.find((s) => s.id === id)?.label ?? id
}

/** "Process via Billing, end of current term", or null when either is missing. */
export function cancelHandlingLine(file: JourneyFile): string | null {
  const processing = PROCESSING_CHOICES.find((o) => o.id === file.cancelHandling?.processing)
  const timing = TIMING_CHOICES.find((o) => o.id === file.cancelHandling?.timing)
  if (!processing || !timing) return null
  return `${processing.label}, ${timing.label.toLowerCase()}`
}

export function offerLine(file: JourneyFile): string {
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
  readonly = false,
  onOpenTab,
}: {
  beat?: PlanBeat
  onJump: (beat: PlanBeat) => void
  readonly?: boolean
  onOpenTab?: () => void
}) {
  const file = useJourney((s) => s.file)
  const globalControl = useCancelSettings((s) => s.globalControl)
  const hasOffers = file.steps.some((s) => s.kind === 'offer')

  const rows: { beat: PlanBeat | null; label: string; value: string }[] = [
    { beat: null, label: 'Flow', value: flowLine(file) || templateLabel(file.template) },
    ...(hasOffers ? [{ beat: 'offers' as const, label: 'Offers', value: offerLine(file) || '—' }] : []),
    { beat: 'audience', label: 'Audience', value: audienceLabel(file.audience) },
    { beat: 'shell', label: 'Shell', value: shellLabel(file.shell) },
    STUDIO
      ? {
          beat: 'holdout',
          label: 'Control',
          value: globalControl === 0 ? 'Global control is off' : `Global control, ${globalControl}% see nothing`,
        }
      : {
          beat: 'holdout',
          label: 'Holdout',
          value: file.holdout === 0 ? 'Everyone in treatment' : `${file.holdout}% see nothing`,
        },
  ]

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative border-b border-slate-100 px-3 py-2">
        {onOpenTab && (
          <button
            type="button"
            onClick={onOpenTab}
            className="absolute right-3 top-2 rounded-md px-[6px] py-[2px] text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            Open as tab
          </button>
        )}
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Draft plan</div>
        <div className="mt-0.5 text-[13px] font-bold text-slate-900">{file.name}</div>
        <div className="text-[11px] text-slate-500">
          {file.source === 'uploaded' ? flowLine(file) || 'Uploaded' : templateLabel(file.template)}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) =>
          row.beat && !readonly ? (
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
  const updateCancelHandling = useJourney((s) => s.updateCancelHandling)
  const offerSteps = file.steps.filter((s) => s.kind === 'offer')

  if (beat === 'walk') {
    return (
      <CtaPair
        primary={{ label: 'Walk this as a subscriber', onClick: onPreview }}
        secondary={{ label: 'Skip walk for now', onClick: () => onContinue('Skip walk for now') }}
      />
    )
  }

  if (beat === 'publish' && V8) {
    return (
      <CtaPair
        primary={{ label: 'Publish', onClick: onConfirm }}
        secondary={{ label: 'Walk it in Preview', onClick: onPreview }}
      />
    )
  }

  if (beat === 'tests') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <SplitEditor compact />
        <div className="mt-3 flex justify-end">
          <SButton
            size="small"
            variant="primary"
            className="w-auto shrink-0"
            onClick={() => onContinue(splitLine(useOrchestration.getState().play))}
          >
            Continue
          </SButton>
        </div>
      </div>
    )
  }

  if (beat === 'publish' || beat === 'review') {
    return (
      <CtaPair
        primary={{ label: 'Walk this as a subscriber', onClick: onPreview }}
        secondary={{
          label: beat === 'publish' ? 'Publish anyway' : 'Looks good — I’m done for now',
          onClick: onConfirm,
        }}
      />
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
          {V8 && <AudienceRules />}
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

      {beat === 'holdout' && STUDIO && <GlobalControlNote onContinue={onContinue} />}

      {beat === 'holdout' && !STUDIO && (
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

      {beat === 'cancel' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Processing</div>
            {PROCESSING_CHOICES.map((o) => (
              <Choice
                key={o.id}
                label={o.label}
                hint={o.hint}
                selected={file.cancelHandling?.processing === o.id}
                onClick={() => updateCancelHandling({ processing: o.id })}
              />
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Cancel timing</div>
            {TIMING_CHOICES.map((o) => (
              <Choice
                key={o.id}
                label={o.label}
                hint={o.hint}
                selected={file.cancelHandling?.timing === o.id}
                onClick={() => updateCancelHandling({ timing: o.id })}
              />
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Return URLs <span className="font-medium normal-case text-slate-400">(optional)</span>
            </div>
            <UrlRow
              label="Never mind"
              placeholder="https://app.example.com/account"
              value={file.cancelHandling?.nevermindUrl ?? ''}
              onCommit={(v) => updateCancelHandling({ nevermindUrl: v })}
            />
            <UrlRow
              label="After cancel"
              placeholder="https://example.com/goodbye"
              value={file.cancelHandling?.cancelUrl ?? ''}
              onCommit={(v) => updateCancelHandling({ cancelUrl: v })}
            />
          </div>
          <div className="flex justify-end gap-[8px]">
            {V8 && (
              <SButton
                size="small"
                variant="neutral-ghost"
                className="w-auto shrink-0"
                onClick={() => onContinue('Set cancel handling later')}
              >
                Do this later
              </SButton>
            )}
            <SButton
              size="small"
              variant="primary"
              className="w-auto shrink-0"
              disabled={!(file.cancelHandling?.processing && file.cancelHandling?.timing)}
              onClick={() => onContinue('Set cancellation handling')}
            >
              Save cancellation handling
            </SButton>
          </div>
        </div>
      )}

      {beat === 'experiment' && (
        <div className="flex flex-wrap items-center justify-end gap-[8px]">
          <SButton
            size="small"
            variant="neutral-outline"
            className="w-auto shrink-0"
            onClick={() => onContinue('Adjust the split on the canvas')}
          >
            I’ll adjust it
          </SButton>
          <SButton
            size="small"
            variant="primary"
            className="w-auto shrink-0"
            onClick={() => onContinue('The split looks right')}
          >
            The split looks right
          </SButton>
        </div>
      )}

      {beat === 'brand' && (
        <MatchSiteCard
          compact
          onMatched={() => onContinue(`Use ${useJourney.getState().file.brand.merchant}`)}
        />
      )}

      {beat !== 'audience' &&
        !(beat === 'holdout' && STUDIO) &&
        beat !== 'shell' &&
        beat !== 'brand' &&
        beat !== 'cancel' &&
        beat !== 'experiment' && (
        <div className="mt-3">
          <CtaPair
            primary={{ label: keepLabel(beat, file), onClick: () => onContinue(keepLabel(beat, file)) }}
            secondary={{ label: KEEP_REST, onClick: onKeepDefaults }}
          />
        </div>
      )}
      {beat === 'brand' && !isBrandMatched(file.brand) && (
        <div className="mt-3 flex justify-end">
          <SButton
            size="small"
            variant="neutral-ghost"
            className="w-auto shrink-0"
            onClick={() => onContinue('Match the look later')}
          >
            Do this later
          </SButton>
        </div>
      )}
      {(beat === 'audience' || beat === 'shell') && (
        <div className="mt-3 flex justify-end">
          <SButton size="small" variant="neutral-ghost" className="w-auto shrink-0" onClick={onKeepDefaults}>
            {KEEP_REST}
          </SButton>
        </div>
      )}
    </div>
  )
}

function AudienceRules() {
  const audience = useOrchestration((s) => s.play.audience)
  if (audience.targetAll) return null
  return <p className="px-1 pt-1 font-mono text-[11.5px] text-slate-500">{audienceSummary(audience)}</p>
}

function GlobalControlNote({ onContinue }: { onContinue: (said: string) => void }) {
  const globalControl = useCancelSettings((s) => s.globalControl)
  const openSettings = useCancelSettings((s) => s.setSettingsOpen)
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-slate-600">Global control</span>
        <span className="text-[11px] tabular-nums text-slate-400">{globalControl === 0 ? 'Off' : `${globalControl}%`}</span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
        {globalControl === 0
          ? 'Everyone who clicks Cancel can get a cancel page.'
          : `${globalControl}% of everyone who clicks Cancel gets no cancel page, in every cancel experience.`}
      </p>
      <div className="mt-3">
        <CtaPair
          primary={{ label: 'Continue', onClick: () => onContinue('Keep Global control as it is') }}
          secondary={{ label: 'Open cancel page settings', onClick: () => openSettings(true) }}
        />
      </div>
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

function UrlRow({
  label,
  placeholder,
  value,
  onCommit,
}: {
  label: string
  placeholder: string
  value: string
  onCommit: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-medium text-slate-500">{label}</span>
      <input
        type="url"
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => {
          const next = e.target.value.trim()
          if (next !== value) onCommit(next)
        }}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none placeholder:text-slate-300 hover:border-slate-300 focus:border-slate-400"
      />
    </label>
  )
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
