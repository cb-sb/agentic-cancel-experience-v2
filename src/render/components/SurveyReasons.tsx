import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  SURVEY_MAX_OPTIONS,
  SURVEY_MIN_OPTIONS,
  type SurveyComponent,
  type SurveyReasonOption,
} from '../../types/experience'
import { uid } from '../../lib/id'
import { useRenderCtx } from '../RenderContext'
import { surfaceStyleCss } from '../brand'
import { EditableText, InlineAddButton, InlineDeleteButton, useComponentEdit } from '../Editable'

const DEFAULT_INLINE_PROMPT = 'Help us understand — what led to this?'
const DEFAULT_INLINE_PLACEHOLDER = 'Share as much or as little as you like…'

/** Baseline reason-row appearance before merchant overrides. */
const OPTION_STYLE_DEFAULTS = {
  fillColor: '#ffffff',
  strokeColor: '#e2e8f0',
  strokeWidth: 1,
  shadow: 'none',
} as const

/** Compact reason→offer link control shown on each editable reason row. */
function ReasonOfferLink({
  value,
  offers,
  onChange,
}: {
  value: string | null | undefined
  offers: { id: string; title: string; color: string }[]
  onChange: (offerId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const linked = offers.find((o) => o.id === value) ?? null
  return (
    <div className="relative flex-none">
      {linked ? (
        <div
          className="inline-flex items-center rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-600"
          style={{ boxShadow: `inset 2px 0 0 ${linked.color}` }}
        >
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            title={`Routes to “${linked.title}” — click to switch`}
            className="inline-flex max-w-[116px] items-center gap-1.5 py-1 pl-2.5 pr-1.5"
          >
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: linked.color }} />
            <span className="truncate">{linked.title}</span>
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Unlink offer"
            aria-label="Unlink offer"
            className="mr-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Link a save offer to this reason"
          className="inline-flex max-w-[132px] items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
          </svg>
          Link offer
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-slate-50 ${!value ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
            >
              <span className="h-2 w-2 flex-none rounded-full border border-slate-300" />
              No linked offer
            </button>
            {offers.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-slate-50 ${value === o.id ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
              >
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: o.color }} />
                <span className="truncate">{o.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className="flex h-4 w-4 flex-none items-center justify-center rounded-full border"
      style={{
        borderColor: checked ? 'var(--brand-accent)' : '#cbd5e1',
        borderWidth: checked ? 5 : 1.5,
        transition: 'border 120ms ease',
      }}
    />
  )
}

function FollowUp({
  option,
  value,
  onChange,
  interactive,
}: {
  option: SurveyReasonOption
  value: string
  onChange: (v: string) => void
  interactive: boolean
}) {
  const fu = option.followUp
  if (!fu?.enabled && !option.isOther) return null
  const prompt = option.isOther ? 'Tell us more' : fu?.prompt ?? 'Tell us more'
  const placeholder = option.isOther
    ? 'What led to this decision?'
    : fu?.placeholder ?? 'e.g. $49/month, or whatever fits your budget right now…'
  return (
    <div className="mt-3">
      <label className="text-[13px] font-medium text-slate-600">
        {prompt} <span className="font-normal text-slate-400">optional</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!interactive}
        placeholder={placeholder}
        rows={2}
        className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-300 focus:border-slate-400"
      />
    </div>
  )
}

/** Fades its children in on mount (used for the inline follow-up input). */
function FadeIn({ className, children }: { className?: string; children: ReactNode }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div className={`transition-opacity duration-300 ease-out ${on ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}>
      {children}
    </div>
  )
}

/**
 * Play-mode inline-reason list. Selecting a reason fades + collapses the other
 * options and expands a shared free-text follow-up into the vacated space. The
 * container is locked to the natural (unselected) height the moment a reason is
 * picked, so the surrounding modal never grows when reasoning is captured.
 */
function InlineReasonList({ component }: { component: SurveyComponent }) {
  const { interactive, session, actions } = useRenderCtx()
  const ref = useRef<HTMLDivElement>(null)
  const [lockHeight, setLockHeight] = useState<number | undefined>(undefined)
  const selectedId = session.selectedReasonId
  const hasSelection = !!selectedId

  // Capture the unselected height (and keep it fresh on resize) so the expanded
  // state reuses the exact same box.
  useLayoutEffect(() => {
    if (hasSelection) return
    const el = ref.current
    if (!el) return
    const measure = () => setLockHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasSelection, component.options.length])

  const prompt = component.inlinePrompt || DEFAULT_INLINE_PROMPT
  const placeholder = component.inlinePlaceholder || DEFAULT_INLINE_PLACEHOLDER
  const rowStyle = surfaceStyleCss(component.optionStyle, OPTION_STYLE_DEFAULTS)

  return (
    <div ref={ref} className="flex flex-col" style={{ height: hasSelection ? lockHeight : undefined }}>
      {component.options.map((option) => {
        const isSel = selectedId === option.id
        const collapsed = hasSelection && !isSel
        return (
          <div
            key={option.id}
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{ maxHeight: collapsed ? 0 : 200, opacity: collapsed ? 0 : 1, marginBottom: collapsed ? 0 : 10 }}
          >
            <div
              role="button"
              tabIndex={interactive ? 0 : -1}
              onClick={() => interactive && actions.selectReason(option.id)}
              onKeyDown={(e) => {
                if (interactive && (e.key === 'Enter' || e.key === ' ')) actions.selectReason(option.id)
              }}
              className="rounded-xl px-4 py-3.5 transition-colors"
              style={{
                ...rowStyle,
                borderColor: isSel ? 'var(--brand-accent)' : rowStyle.borderColor,
                background: isSel ? 'rgba(148,163,184,0.06)' : rowStyle.background,
                cursor: interactive ? 'pointer' : 'default',
              }}
            >
              <div className="flex items-center gap-3">
                <Radio checked={isSel} />
                <span className="flex-1 text-sm font-medium text-slate-700" dangerouslySetInnerHTML={{ __html: option.label }} />
              </div>
            </div>
          </div>
        )
      })}

      {hasSelection && selectedId && (
        <FadeIn className="flex min-h-0 flex-1 flex-col pt-1">
          <div className="flex items-baseline justify-between gap-3">
            <label className="text-[13px] font-medium text-slate-600">
              {prompt} <span className="font-normal text-slate-400">optional</span>
            </label>
            {interactive && (
              <button
                type="button"
                onClick={() => actions.selectReason(null)}
                className="flex-none text-[12px] font-semibold transition-colors hover:opacity-80"
                style={{ color: 'var(--brand-primary)' }}
              >
                ‹ Change reason
              </button>
            )}
          </div>
          <textarea
            value={session.reasonText[selectedId] ?? ''}
            onChange={(e) => actions.setReasonText(selectedId, e.target.value)}
            readOnly={!interactive}
            placeholder={placeholder}
            className="mt-1.5 min-h-0 w-full flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-300 focus:border-slate-400"
          />
        </FadeIn>
      )}
    </div>
  )
}

export function SurveyReasons({ component }: { component: SurveyComponent }) {
  const { interactive, mode, session, actions, mapping } = useRenderCtx()
  const set = useComponentEdit(component.id)
  const editing = mode === 'compose'

  const updateOption = (id: string, patch: Partial<SurveyReasonOption>) =>
    set({ options: component.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) })

  const removeOption = (id: string) =>
    set({ options: component.options.filter((o) => o.id !== id) })

  const addOption = () => {
    const next: SurveyReasonOption = {
      id: uid('rs'),
      label: 'New reason',
      code: 'custom',
      followUp: null,
      linkedOfferId: null,
    }
    set({ options: [...component.options, next] })
  }

  const canDelete = component.options.length > SURVEY_MIN_OPTIONS
  const canAdd = component.options.length < SURVEY_MAX_OPTIONS

  // ---- Free text -----------------------------------------------------------
  if (component.presentation === 'free_text') {
    return (
      <div>
        <EditableText
          as="label"
          value={component.freeTextPrompt ?? ''}
          onCommit={(v) => set({ freeTextPrompt: v })}
          placeholder="Prompt"
          singleLine
          className="text-sm font-medium text-slate-600"
        />
        <textarea
          value={session.reasonText['free'] ?? ''}
          onChange={(e) => actions.setReasonText('free', e.target.value)}
          readOnly={!interactive}
          rows={4}
          placeholder="Share as much or as little as you like…"
          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-300 focus:border-slate-400"
        />
      </div>
    )
  }

  // ---- Dropdown (Play only — Compose shows the editable list below) --------
  if (component.presentation === 'dropdown' && !editing) {
    const selected = component.options.find((o) => o.id === session.selectedReasonId)
    return (
      <div>
        <select
          value={session.selectedReasonId ?? ''}
          onChange={(e) => actions.selectReason(e.target.value)}
          disabled={!interactive}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {component.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label.replace(/<[^>]+>/g, '')}
            </option>
          ))}
        </select>
        {selected && (
          <FollowUp
            option={selected}
            value={session.reasonText[selected.id] ?? ''}
            onChange={(v) => actions.setReasonText(selected.id, v)}
            interactive={interactive}
          />
        )}
      </div>
    )
  }

  // ---- Inline reason (Play): fade siblings + expand a shared follow-up -----
  if (component.presentation === 'inline_reason' && !editing) {
    return <InlineReasonList component={component} />
  }

  // ---- Radio (Play) or editable reason list (Compose) ----------------------
  const rowStyle = surfaceStyleCss(component.optionStyle, OPTION_STYLE_DEFAULTS)
  const linkableOffers = mapping?.linkableOffers ?? []
  const showLink = editing && linkableOffers.length > 0
  return (
    <div className="space-y-2.5">
      {component.options.map((option) => {
        const checked = !editing && session.selectedReasonId === option.id
        return (
          <div
            key={option.id}
            data-reason-anchor={editing && mapping ? `${mapping.experienceId}:${option.id}` : undefined}
            role={editing ? undefined : 'button'}
            tabIndex={interactive ? 0 : -1}
            onClick={() => interactive && actions.selectReason(option.id)}
            onKeyDown={(e) => {
              if (interactive && (e.key === 'Enter' || e.key === ' ')) actions.selectReason(option.id)
            }}
            className="group/reason rounded-xl px-4 py-3.5 transition-colors"
            style={{
              ...rowStyle,
              borderColor: checked ? 'var(--brand-accent)' : rowStyle.borderColor,
              background: checked ? 'rgba(148,163,184,0.06)' : rowStyle.background,
              cursor: interactive ? 'pointer' : 'default',
            }}
          >
            <div className="flex items-center gap-3">
              <Radio checked={checked} />
              {editing ? (
                <EditableText
                  value={option.label}
                  onCommit={(v) => updateOption(option.id, { label: v })}
                  placeholder="Reason"
                  singleLine
                  className="flex-1 text-sm font-medium text-slate-700"
                />
              ) : (
                <span
                  className="flex-1 text-sm font-medium text-slate-700"
                  dangerouslySetInnerHTML={{ __html: option.label }}
                />
              )}
              {showLink && !option.isOther && (
                <ReasonOfferLink
                  value={option.linkedOfferId}
                  offers={linkableOffers}
                  onChange={(offerId) => updateOption(option.id, { linkedOfferId: offerId })}
                />
              )}
              {editing && (
                <InlineDeleteButton
                  onRemove={() => removeOption(option.id)}
                  disabled={!canDelete || option.isOther}
                  title={option.isOther ? '"Other" is required' : 'Remove reason'}
                />
              )}
            </div>
            {checked && (
              <div className="pl-7">
                <FollowUp
                  option={option}
                  value={session.reasonText[option.id] ?? ''}
                  onChange={(v) => actions.setReasonText(option.id, v)}
                  interactive={interactive}
                />
              </div>
            )}
          </div>
        )
      })}

      {editing && (
        <div className="flex items-center gap-3 pt-1">
          <InlineAddButton onAdd={addOption} disabled={!canAdd} label="Add reason" />
          <span className="text-[12px] text-slate-400">
            {component.options.length}/{SURVEY_MAX_OPTIONS} reasons · min {SURVEY_MIN_OPTIONS}
          </span>
        </div>
      )}

      {editing && component.presentation === 'inline_reason' && (
        <div className="mt-1 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Inline follow-up · shown after a reason is picked
          </div>
          <EditableText
            value={component.inlinePrompt ?? DEFAULT_INLINE_PROMPT}
            onCommit={(v) => set({ inlinePrompt: v })}
            placeholder="Follow-up question"
            singleLine
            className="mt-1.5 text-sm font-medium text-slate-600"
          />
          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <EditableText
              value={component.inlinePlaceholder ?? DEFAULT_INLINE_PLACEHOLDER}
              onCommit={(v) => set({ inlinePlaceholder: v })}
              placeholder="Placeholder text"
              singleLine
              className="text-sm text-slate-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}
