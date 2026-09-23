import { useEffect, useRef } from 'react'
import { usePresence } from '../lib/usePresence'
import { EASE_ENTER, EASE_LEAVE } from '../lib/motion'
import { useOrchestration, type PlayConfigSection } from '../store/useOrchestration'
import { useJourney } from '../store/useJourney'
import type { CancelProcessing, CancelTiming } from '../journey/types'
import { AudienceSetup, SplitSetup } from './NodeSetup'
import type { SplitNode } from '../types/orchestration'

/**
 * Two fifths of the window, with a floor: the sidebar scales with the display,
 * but a condition row still has to fit on a laptop.
 */
const WIDTH = 'max(380px, 40vw)'
/**
 * ...while the settings inside stay one column. The width is set by the widest
 * thing in here — a targeting rule, which is property, operator and value on a
 * single line — and past that it is only distance between a label and its
 * field, so the surplus goes to margin instead.
 */
const CONTENT_W = 720
const IN_MS = 200
const OUT_MS = 140
const SLIDE = 28

/** The width the collapsed rail stands on. */
export const CONFIG_RAIL_W = 34

const TAB_LABEL: Record<PlayConfigSection, string> = {
  audience: 'Audience',
  targeting: 'Targeting',
  cancel: 'Cancellation',
}

/**
 * Which sections the play exposes: audience always, targeting once there is a
 * split to divide, and cancellation handling always — it is the routing every
 * cancel page needs regardless of how traffic is split.
 */
function useConfigSections(): PlayConfigSection[] {
  const kind = useOrchestration((s) => s.play.targeting.kind)
  return kind === 'split' ? ['audience', 'targeting', 'cancel'] : ['audience', 'cancel']
}

/**
 * Who this play reaches and how they are divided — a rail on the canvas edge
 * that expands into a panel.
 *
 * These two used to be buttons in the play's toolbar, which put settings that
 * are decided once beside the mode switch you use constantly, and made them
 * reachable from a preview where they mean nothing. The rail moves them to the
 * edge of the thing they configure: always visible, costing 34px, and expanding
 * in place rather than navigating anywhere.
 *
 * Trigger is deliberately absent: a cancel experience is entered from the
 * merchant's own cancel link, so there is nothing here to decide.
 *
 * The scrim is deliberately light. Targeting changes the shape of the play
 * behind — a split adds branches to the canvas — so the canvas has to stay
 * readable while it is being edited, not just present.
 */
export function PlayConfigSidebar() {
  const configTarget = useOrchestration((s) => s.configTarget)
  const closeConfig = useOrchestration((s) => s.closeConfig)
  const openConfig = useOrchestration((s) => s.openConfig)
  const play = useOrchestration((s) => s.play)
  const sections = useConfigSections()

  const split = play.targeting.kind === 'split' ? (play.targeting as SplitNode) : null
  const target = sections.find((s) => s === configTarget) ?? null

  const panel = usePresence(target !== null, OUT_MS)
  // The section outlives the state that chose it, by exactly one exit: closing
  // clears it immediately, and a panel with nothing in it cannot slide out.
  const last = useRef<PlayConfigSection>('audience')
  if (target) last.current = target
  const section = target ?? last.current

  useEffect(() => {
    if (!panel.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeConfig()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel.open, closeConfig])

  const ms = panel.open ? IN_MS : OUT_MS
  const ease = panel.open ? EASE_ENTER : EASE_LEAVE

  return (
    <>
      {/* The rail stays put while the panel is open — it is where the panel
          came from, and where clicking the active tab puts it back. */}
      <ConfigRail
        sections={sections}
        active={target}
        onPick={(s) => (target === s ? closeConfig() : openConfig(s))}
      />

      {panel.alive && (
        <>
          <div
            aria-hidden
            onClick={closeConfig}
            className="absolute inset-0 z-30 bg-slate-900/10 motion-reduce:transition-none"
            style={{ opacity: panel.open ? 1 : 0, transition: `opacity ${ms}ms ${ease}` }}
          />

          <aside
            className="absolute inset-y-0 right-0 z-40 flex flex-col border-l border-slate-200 bg-white shadow-[-8px_0_28px_rgba(15,23,42,0.10)] motion-reduce:transition-none"
            style={{
              width: WIDTH,
              opacity: panel.open ? 1 : 0,
              transform: `translateX(${panel.open ? 0 : SLIDE}px)`,
              transition: `opacity ${ms}ms ${ease}, transform ${ms}ms ${ease}`,
            }}
          >
            {/* The tabs sit in the panel's own header. They were here once and
                were taken out because the toolbar buttons claimed the same
                choice a few hundred pixels away; with those gone, switching
                section without collapsing back to the rail is worth a strip. */}
            <div className="flex flex-none items-center gap-1 border-b border-slate-200 px-3 py-2">
              {sections.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => openConfig(s)}
                  aria-pressed={section === s}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    section === s
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {TAB_LABEL[s]}
                </button>
              ))}
              <button
                type="button"
                onClick={closeConfig}
                title="Collapse (esc)"
                aria-label="Collapse"
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 6l6 6-6 6M5 6l6 6-6 6" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mx-auto" style={{ maxWidth: CONTENT_W }}>
                {section === 'audience' ? (
                  <AudienceSetup />
                ) : section === 'targeting' ? (
                  split && <SplitSetup split={split} />
                ) : (
                  <CancelHandlingSetup />
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  )
}

/**
 * The collapsed rail: one vertical tab per section, on the canvas edge.
 *
 * Vertical text is a cost, paid to keep the rail narrow enough that leaving it
 * there permanently is cheaper than a button that has to live somewhere else.
 * An unset audience is flagged here, because it is the one gap that silently
 * stops a play from reaching anyone.
 */
function ConfigRail({
  sections,
  active,
  onPick,
}: {
  sections: PlayConfigSection[]
  active: PlayConfigSection | null
  onPick: (s: PlayConfigSection) => void
}) {
  const play = useOrchestration((s) => s.play)
  const cancelHandling = useJourney((s) => s.file.cancelHandling)
  const audienceSet = play.audience.targetAll || (play.audience.conditions?.length ?? 0) > 0
  const cancelSet = Boolean(cancelHandling?.processing && cancelHandling?.timing)

  return (
    <div
      className="absolute inset-y-0 right-0 z-20 flex flex-col items-center justify-center gap-2 border-l border-slate-200 bg-white/80 backdrop-blur-sm"
      style={{ width: CONFIG_RAIL_W }}
    >
      {sections.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          aria-pressed={active === s}
          title={`${TAB_LABEL[s]} settings`}
          className={`flex items-center gap-1.5 rounded-md px-1 py-3 text-[11.5px] font-semibold transition-colors ${
            active === s
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
          style={{ writingMode: 'vertical-rl' }}
        >
          {TAB_LABEL[s]}
          {s === 'audience' && !audienceSet && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
          {s === 'cancel' && !cancelSet && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
        </button>
      ))}
    </div>
  )
}

const PROCESSING_OPTIONS: { id: CancelProcessing; label: string; hint: string }[] = [
  { id: 'billing_api', label: 'Process via Billing', hint: "Growth cancels the subscription through Chargebee's API." },
  { id: 'override', label: 'Override', hint: 'Hand off to your own email, URL, or webhook instead.' },
]

const TIMING_OPTIONS: { id: CancelTiming; label: string; hint: string }[] = [
  { id: 'immediate', label: 'Immediately', hint: 'Cancel takes effect the moment it is confirmed.' },
  { id: 'end_of_term', label: 'End of current term', hint: 'Access continues until this term ends.' },
  { id: 'end_of_billing_term', label: 'End of billing term', hint: 'Cancel at the end of the paid billing cycle.' },
]

/**
 * Cancellation handling — Growth's Button and Billing Configurations: where
 * Never mind / Cancel route, how the cancel is processed, and when it lands.
 * Billing- and compliance-critical, so it is a first-class config, not an
 * assumption buried in the page.
 */
function CancelHandlingSetup() {
  const cancelHandling = useJourney((s) => s.file.cancelHandling)
  const update = useJourney((s) => s.updateCancelHandling)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[14px] font-bold text-slate-900">Cancellation handling</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
          What happens once the subscriber is done with the page — how the cancel is processed, when
          it takes effect, and where each button sends them.
        </p>
      </div>

      <fieldset>
        <legend className="text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
          Processing
        </legend>
        <div className="mt-2 space-y-2">
          {PROCESSING_OPTIONS.map((o) => (
            <OptionRow
              key={o.id}
              label={o.label}
              hint={o.hint}
              selected={cancelHandling?.processing === o.id}
              onClick={() => update({ processing: o.id })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
          Cancel timing
        </legend>
        <div className="mt-2 space-y-2">
          {TIMING_OPTIONS.map((o) => (
            <OptionRow
              key={o.id}
              label={o.label}
              hint={o.hint}
              selected={cancelHandling?.timing === o.id}
              onClick={() => update({ timing: o.id })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
          Return URLs <span className="font-normal normal-case text-slate-400">(optional)</span>
        </legend>
        <UrlField
          label="Never mind"
          placeholder="https://app.example.com/account"
          value={cancelHandling?.nevermindUrl ?? ''}
          onCommit={(v) => update({ nevermindUrl: v })}
        />
        <UrlField
          label="After cancel"
          placeholder="https://example.com/goodbye"
          value={cancelHandling?.cancelUrl ?? ''}
          onCommit={(v) => update({ cancelUrl: v })}
        />
      </fieldset>
    </div>
  )
}

function OptionRow({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string
  hint: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
        selected
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
      }`}
    >
      <div className="text-[13px] font-semibold">{label}</div>
      <div className={`mt-0.5 text-[11.5px] leading-snug ${selected ? 'text-white/70' : 'text-slate-500'}`}>
        {hint}
      </div>
    </button>
  )
}

function UrlField({
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
      <span className="text-[12px] font-medium text-slate-600">{label}</span>
      <input
        type="url"
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => {
          const next = e.target.value.trim()
          if (next !== value) onCommit(next)
        }}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none placeholder:text-slate-300 hover:border-slate-300 focus:border-slate-400"
      />
    </label>
  )
}
