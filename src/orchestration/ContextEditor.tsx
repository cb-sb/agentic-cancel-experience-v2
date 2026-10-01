import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { V8 } from '../layout/layoutMode'
import { SButton, SIcon } from '@chargebee/sting-react'
import { useJourney } from '../store/useJourney'
import { useExperience } from '../store/useExperience'
import { patchBrandShortcuts } from '../brand/theme'
import { OFFER_VARIANTS, offerVariantPatch } from '../lib/offerVariants'
import { journeysUsing, wordingFromStep } from '../library/offers'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { templateLabel } from '../journey/templates'
import { uploadedScreenChain } from '../journey/contextDoc'
import { setMark } from '../setup/useSetupState'
import { useWorkspace } from '../workspace/useWorkspace'
import { useCopilotThread } from './copilotThread'
import type {
  AudienceKey,
  JourneyStepFile,
  JourneyStepKind,
  OfferKey,
} from '../journey/types'
import type {
  CheckoutComponent,
  ConfirmationComponent,
  LossAversionComponent,
  OfferComponent,
  OutcomeComponent,
  ShellLayout,
  Step,
  SurveyComponent,
} from '../types/experience'

const AUDIENCE_OPTIONS: { id: AudienceKey; label: string }[] = [
  { id: 'all', label: 'All subscribers' },
  { id: 'paying', label: 'Paying subscribers' },
  { id: 'high_value', label: 'High-value subscribers' },
  { id: 'high_risk', label: 'High-risk customers' },
  { id: 'annual', label: 'Annual customers' },
  { id: 'in_trial', label: 'In-trial (active)' },
]

const SHELL_OPTIONS: { id: ShellLayout; label: string }[] = V8
  ? [
      { id: 'modal', label: 'Modal, over your account page' },
      { id: 'fullpage', label: 'Full page, full viewport width' },
      { id: 'fullpage_scroll', label: 'Full page continuous, every step on one page' },
    ]
  : [
      { id: 'modal', label: 'Modal — overlay on the site' },
      { id: 'fullpage', label: 'Full page — hosted cancel page' },
      { id: 'fullpage_scroll', label: 'Scrolling page' },
    ]

const OFFER_OPTIONS = OFFER_VARIANTS.map((v) => ({ id: v.category as OfferKey, label: v.label }))

const KIND_META: Record<JourneyStepKind, { label: string; hint: string }> = {
  loss_aversion: { label: 'Loss aversion', hint: 'What they keep vs. lose' },
  survey: { label: 'Survey', hint: 'Why they’re leaving' },
  offer: { label: 'Save offer', hint: 'The deal you present' },
  pricing_table: { label: 'Plan picker', hint: 'Cheaper plans to switch to' },
  checkout: { label: 'Checkout', hint: 'Confirm the plan change' },
  confirmation: { label: 'Confirmation', hint: 'Final are-you-sure' },
  outcome_saved: { label: 'Saved outcome', hint: 'They stayed' },
  outcome_cancelled: { label: 'Cancelled outcome', hint: 'They left' },
}

/** `apply` may return false to back out (for example a declined shared-offer warning). */
type ConfirmEdit = (what: string, apply: () => void | boolean) => Promise<boolean>

interface EditGate {
  confirming: boolean
  confirm: ConfirmEdit
}

/** True on the Summary tab, which lays fields out as grouped cards. */
const PageCtx = createContext(false)

const EditGateCtx = createContext<EditGate>({
  confirming: false,
  confirm: (_what, apply) => Promise.resolve(apply() !== false),
})

type CommitResult = void | false | Promise<boolean>

/** Puts the field back when the edit was refused or cancelled in the dialog. */
function settle(result: CommitResult, revert: () => void) {
  if (result === false) revert()
  else if (result instanceof Promise) void result.then((ok) => !ok && revert())
}

function ConfirmDialog({ what, onCancel, onSave }: { what: string; onCancel: () => void; onSave: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-[16px]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-edit-title"
        className="relative w-full max-w-[400px] rounded-2xl bg-white p-[20px] shadow-2xl"
      >
        <h3 id="confirm-edit-title" className="text-[15px] font-bold text-slate-900">
          Save this change?
        </h3>
        <p className="mt-[6px] text-[13px] leading-relaxed text-slate-600">{what}</p>
        <div className="mt-[18px] flex justify-end gap-[8px]">
          <SButton size="small" variant="neutral-outline" className="w-auto" onClick={onCancel}>
            Cancel
          </SButton>
          <SButton size="small" variant="primary" className="w-auto" onClick={onSave}>
            Save
          </SButton>
        </div>
      </div>
    </div>
  )
}

function quoted(v: string, max = 48) {
  const t = v.trim()
  return `“${t.length > max ? `${t.slice(0, max - 1)}…` : t}”`
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const page = useContext(PageCtx)
  return (
    <label className="block">
      <span
        className={
          page
            ? 'mb-[6px] block text-[12px] font-medium text-slate-600'
            : 'mb-[4px] block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400'
        }
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-[8px] border border-slate-200 bg-white px-[10px] py-[7px] text-[13px] text-slate-800 outline-none transition-colors focus:border-slate-400'

function TextField({
  label,
  value,
  onCommit,
  multiline,
  placeholder,
}: {
  label: string
  value: string
  onCommit: (v: string) => CommitResult
  multiline?: boolean
  placeholder?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => {
    setV(value)
  }, [value])
  const commit = () => {
    if (v === value) return
    settle(onCommit(v), () => setV(value))
  }
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          value={v}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          rows={3}
          className={`${inputCls} resize-none leading-relaxed`}
        />
      ) : (
        <input
          value={v}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className={inputCls}
        />
      )}
    </Field>
  )
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputCls}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

function ListField({
  label,
  items,
  onCommit,
  addLabel,
}: {
  label: string
  items: string[]
  onCommit: (next: string[]) => CommitResult
  addLabel: string
}) {
  const [rows, setRows] = useState(items)
  useEffect(() => {
    setRows(items)
  }, [items])
  const commit = (next: string[]) => {
    const clean = next.map((r) => r.trim()).filter(Boolean)
    if (clean.length === items.length && clean.every((r, i) => r === items[i])) return
    settle(onCommit(clean), () => setRows(items))
  }
  const setAt = (i: number, val: string) => setRows((r) => r.map((x, j) => (j === i ? val : x)))
  const removeAt = (i: number) => {
    const next = rows.filter((_, j) => j !== i)
    setRows(next)
    commit(next)
  }
  return (
    <Field label={label}>
      <div className="space-y-[6px]">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-[6px]">
            <input
              value={row}
              onChange={(e) => setAt(i, e.target.value)}
              onBlur={() => commit(rows)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              className={inputCls}
            />
            <button
              type="button"
              aria-label="Remove"
              onClick={() => removeAt(i)}
              className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[8px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <SIcon name="x" size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((r) => [...r, ''])}
          className="inline-flex items-center gap-[5px] rounded-[8px] px-[8px] py-[5px] text-[12px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <SIcon name="plus" size={12} /> {addLabel}
        </button>
      </div>
    </Field>
  )
}

/** Saves on every change normally; on blur when each edit is confirmed, so the dialog opens once. */
function NumberField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  onCommit: (v: number) => CommitResult
}) {
  const { confirming } = useContext(EditGateCtx)
  const [v, setV] = useState(String(value))
  useEffect(() => {
    setV(String(value))
  }, [value])
  const clamp = (raw: string) => Math.max(min, Math.min(max, Number(raw) || 0))
  const commit = (raw: string) => {
    const next = clamp(raw)
    if (next === value) {
      setV(String(value))
      return
    }
    settle(onCommit(next), () => setV(String(value)))
  }
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        value={v}
        onChange={(e) => {
          setV(e.target.value)
          if (!confirming) commit(e.target.value)
        }}
        onBlur={() => confirming && commit(v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className={inputCls}
      />
    </Field>
  )
}

function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => CommitResult }) {
  const { confirming } = useContext(EditGateCtx)
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setV(value)
  }, [value])
  const commit = (next: string) => {
    if (next === value) return
    settle(onCommit(next), () => setV(value))
  }
  const commitRef = useRef(commit)
  commitRef.current = commit
  // React's onChange fires while dragging in the picker; the native change event fires once it closes.
  useEffect(() => {
    const el = ref.current
    if (!el || !confirming) return
    const onDone = () => commitRef.current(el.value)
    el.addEventListener('change', onDone)
    return () => el.removeEventListener('change', onDone)
  }, [confirming])
  return (
    <Field label={label}>
      <div className="flex items-center gap-[8px]">
        <input
          ref={ref}
          type="color"
          value={v}
          onChange={(e) => {
            setV(e.target.value)
            if (!confirming) commit(e.target.value)
          }}
          className="h-[32px] w-[40px] flex-none cursor-pointer rounded-[8px] border border-slate-200 bg-white p-[2px]"
        />
        <span className="text-[13px] uppercase text-slate-500">{v}</span>
      </div>
    </Field>
  )
}

function Section({
  title,
  hint,
  badge,
  defaultOpen,
  children,
}: {
  title: string
  hint?: string
  /** Step number, shown in a circle on the Summary tab. */
  badge?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const page = useContext(PageCtx)
  const [open, setOpen] = useState(defaultOpen ?? false)
  if (page) {
    return (
      <div className="border-t border-slate-100 first:border-t-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left transition-colors hover:bg-slate-50"
        >
          {badge !== undefined && (
            <span className="flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold tabular-nums text-slate-600">
              {badge}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-slate-900">{title}</span>
            {hint && <span className="block text-[12px] text-slate-500">{hint}</span>}
          </span>
          <SIcon
            name="chevron-down"
            size={14}
            className={`flex-none text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <div
            className={`space-y-[14px] border-t border-slate-100 bg-slate-50/60 py-[16px] pr-[16px] ${badge !== undefined ? 'pl-[52px]' : 'pl-[16px]'}`}
          >
            {children}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-[10px] px-[12px] py-[10px] text-left"
      >
        <span
          className="flex-none text-slate-400 transition-transform"
          style={{ transform: open ? 'none' : 'rotate(-90deg)' }}
        >
          <SIcon name="chevron-down" size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-slate-800">{title}</span>
          {hint && <span className="block text-[11.5px] text-slate-400">{hint}</span>}
        </span>
      </button>
      {open && <div className="space-y-[12px] border-t border-slate-100 px-[12px] py-[12px]">{children}</div>}
    </div>
  )
}

function comp<K extends string>(step: Step | undefined, kind: K) {
  return step?.components.find((c) => c.kind === kind)
}

/** Kind-specific editor for one step, reading live values from the compiled step. */
function StepEditor({
  fileStep,
  compiled,
  title,
}: {
  fileStep: JourneyStepFile
  compiled: Step | undefined
  title: string
}) {
  const rawUpdateStep = useJourney((s) => s.updateStep)
  const file = useJourney((s) => s.file)
  const offers = useMerchantLibrary((s) => s.offers)
  const journeys = useMerchantLibrary((s) => s.journeys)
  const { confirm, confirming } = useContext(EditGateCtx)
  const id = fileStep.id
  const edit = (what: string, patch: Partial<JourneyStepFile>) =>
    confirm(`${what} on ${title}.`, () => rawUpdateStep(id, patch))
  const updateStep = rawUpdateStep
  const setHeadline = (v: string) =>
    edit(v.trim() ? `Set the headline to ${quoted(v)}` : 'Clear the headline', { headline: v.trim() || undefined })
  const setBody = (v: string) =>
    edit(v.trim() ? `Set the text to ${quoted(v)}` : 'Clear the text', { body: v.trim() || undefined })
  const setList = (what: string, content: JourneyStepFile['content']) =>
    edit(`Update ${what}`, { content })
  const shared = offers.find((o) => o.id === fileStep.sharedOfferId)
  const used = fileStep.sharedOfferId ? journeysUsing(fileStep.sharedOfferId, journeys, file) : []

  const sharedNote =
    fileStep.sharedOfferId && used.length > 1
      ? ` This offer is used in ${used.length} experiences, so all of them change.`
      : ''

  const keepOffer = (step: JourneyStepFile): boolean => {
    if (fileStep.sharedOfferId && used.length > 1 && !confirming) {
      const ok = window.confirm(
        `This offer is used in ${used.length} experiences. Keeping this change updates all of them.`,
      )
      if (!ok) return false
    }
    if (fileStep.sharedOfferId) {
      useMerchantLibrary.getState().updateOffer(fileStep.sharedOfferId, wordingFromStep(step, shared))
    }
    updateStep(id, {
      offer: step.offer,
      headline: step.headline,
      body: step.body,
      sharedOfferId: step.sharedOfferId,
    })
    return true
  }

  switch (fileStep.kind) {
    case 'loss_aversion': {
      const c = comp(compiled, 'loss_aversion') as LossAversionComponent | undefined
      return (
        <>
          <TextField label="Headline" value={compiled?.title ?? ''} onCommit={setHeadline} />
          <ListField
            label="What they'll keep"
            items={(c?.keepItems ?? []).map((i) => i.label)}
            addLabel="Add a benefit"
            onCommit={(keepItems) => setList('what they keep', { keepItems })}
          />
          <ListField
            label="What they'll lose"
            items={(c?.loseItems ?? []).map((i) => i.label)}
            addLabel="Add a loss"
            onCommit={(loseItems) => setList('what they lose', { loseItems })}
          />
        </>
      )
    }
    case 'survey': {
      const c = comp(compiled, 'survey') as SurveyComponent | undefined
      return (
        <>
          <TextField label="Question" value={compiled?.title ?? ''} onCommit={setHeadline} />
          <TextField label="Subtext" value={compiled?.description ?? ''} onCommit={setBody} />
          <ListField
            label="Reasons"
            items={(c?.options ?? []).map((o) => o.label)}
            addLabel="Add a reason"
            onCommit={(surveyReasons) => setList('the reasons', { surveyReasons })}
          />
          <TextField
            label="Free-text prompt"
            value={c?.freeTextPrompt ?? ''}
            onCommit={(v) =>
              edit(v.trim() ? `Set the free-text prompt to ${quoted(v)}` : 'Clear the free-text prompt', {
                content: { surveyPrompt: v.trim() || undefined },
              })
            }
          />
        </>
      )
    }
    case 'offer': {
      const c = comp(compiled, 'offer') as OfferComponent | undefined
      const offerType = (shared?.offer ?? c?.category ?? 'discount') as OfferKey
      return (
        <>
          <SelectField
            label="Use an offer"
            value={fileStep.sharedOfferId ?? ''}
            options={[
              { id: '', label: offers.length ? 'Start a new offer' : 'Start a new offer (none saved yet)' },
              ...offers.map((o) => ({ id: o.id, label: o.name })),
            ]}
            onChange={(picked) => {
              if (!picked) {
                void edit('Start a new offer', {
                  sharedOfferId: undefined,
                  offer: 'discount',
                  headline: undefined,
                  body: undefined,
                })
                return
              }
              const existing = offers.find((o) => o.id === picked)
              if (!existing) return
              void edit(`Use the saved offer ${quoted(existing.name)}`, {
                sharedOfferId: existing.id,
                offer: existing.offer,
                headline: existing.title,
                body: existing.description,
              })
            }}
          />
          {fileStep.sharedOfferId && (
            <p className="rounded-[10px] bg-slate-50 px-[12px] py-[8px] text-[12px] leading-relaxed text-slate-600">
              Shared offer. Used in {used.length} experience{used.length === 1 ? '' : 's'}.
              {used.length > 1 ? ' A change here updates all of them.' : ''}
            </p>
          )}
          <SelectField
            label="Offer type"
            value={offerType}
            options={OFFER_OPTIONS}
            onChange={(offer) => {
              const patch = offerVariantPatch(offer)
              const label = OFFER_OPTIONS.find((o) => o.id === offer)?.label ?? offer
              void confirm(`Change the offer type to ${label} on ${title}.${sharedNote}`, () =>
                keepOffer({
                  ...fileStep,
                  offer,
                  headline: patch.title,
                  body: patch.description,
                }),
              )
            }}
          />
          <TextField
            label="Headline"
            value={c?.title ?? ''}
            onCommit={(v) => {
              const headline = v.trim()
              if (!headline) return false
              return confirm(`Set the headline to ${quoted(headline)} on ${title}.${sharedNote}`, () =>
                keepOffer({ ...fileStep, headline }),
              )
            }}
          />
          <TextField
            label="Description"
            value={c?.description ?? ''}
            onCommit={(v) =>
              confirm(`Set the text to ${quoted(v)} on ${title}.${sharedNote}`, () =>
                keepOffer({ ...fileStep, body: v.trim() }),
              )
            }
            multiline
          />
          {fileStep.sharedOfferId && (
            <button
              type="button"
              onClick={() => {
                void confirm(`Make a separate copy of this offer for ${title}. Other experiences keep the original.`, () => {
                  const copy = useMerchantLibrary.getState().duplicateOffer(fileStep.sharedOfferId!)
                  if (!copy) return false
                  updateStep(id, {
                    sharedOfferId: copy.id,
                    offer: copy.offer,
                    headline: copy.title,
                    body: copy.description,
                  })
                })
              }}
              className="text-[12.5px] font-semibold text-slate-600 hover:text-slate-900"
            >
              Make a separate copy
            </button>
          )}
        </>
      )
    }
    case 'pricing_table':
      return <TextField label="Headline" value={compiled?.title ?? ''} onCommit={setHeadline} />
    case 'checkout': {
      const c = comp(compiled, 'checkout') as CheckoutComponent | undefined
      return (
        <>
          <TextField label="Headline" value={c?.title ?? compiled?.title ?? ''} onCommit={setHeadline} />
          <TextField label="Subtext" value={c?.subtitle ?? ''} onCommit={setBody} multiline />
        </>
      )
    }
    case 'confirmation': {
      const c = comp(compiled, 'confirmation') as ConfirmationComponent | undefined
      return (
        <>
          <TextField label="Headline" value={c?.title ?? ''} onCommit={setHeadline} />
          <TextField label="Subtext" value={c?.subtitle ?? ''} onCommit={setBody} multiline />
        </>
      )
    }
    case 'outcome_saved':
    case 'outcome_cancelled': {
      const c = comp(compiled, 'outcome') as OutcomeComponent | undefined
      return (
        <>
          <TextField label="Headline" value={c?.headline ?? ''} onCommit={setHeadline} />
          <TextField label="Body" value={c?.body ?? ''} onCommit={setBody} multiline />
        </>
      )
    }
  }
}

function PageHeading({ title }: { title: string }) {
  return <h3 className="mb-[10px] px-[2px] text-[14px] font-semibold text-slate-900">{title}</h3>
}

interface PendingEdit {
  what: string
  apply: () => void | boolean
  resolve: (ok: boolean) => void
}

/**
 * Structured Context surface — a complete map of the growth workflow. Each step
 * is an expandable component editor; global sections cover who sees it and how
 * it's dressed. Every edit writes to the JourneyFile and recompiles the canvas.
 * `confirmEdits` asks before each edit is saved; `page` lays it out for a full tab.
 */
export function ContextEditor({ confirmEdits = false, page = false }: { confirmEdits?: boolean; page?: boolean }) {
  const file = useJourney((s) => s.file)
  const rawPatchFile = useJourney((s) => s.patchFile)
  const compiledSteps = useExperience((s) => s.experience.steps)
  const uploaded = file.source === 'uploaded'
  const [pending, setPending] = useState<PendingEdit | null>(null)

  const gate: EditGate = confirmEdits
    ? {
        confirming: true,
        confirm: (what, apply) => new Promise<boolean>((resolve) => setPending({ what, apply, resolve })),
      }
    : { confirming: false, confirm: (_what, apply) => Promise.resolve(apply() !== false) }

  const patch = (what: string, next: Parameters<typeof rawPatchFile>[0]) => gate.confirm(what, () => rawPatchFile(next))

  const cancelPending = () => {
    pending?.resolve(false)
    setPending(null)
  }
  const savePending = () => {
    if (!pending) return
    const ok = pending.apply() !== false
    pending.resolve(ok)
    setPending(null)
  }

  if (file.steps.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-[24px] py-[48px] text-center">
        <p className="max-w-[260px] text-[13px] leading-relaxed text-slate-400">
          {page
            ? 'No flow yet. Start from a template or upload your pages, and the plan shows up here.'
            : V8
              ? 'No flow yet. Ask Copilot to start a cancel experience, then edit every component here.'
              : 'No flow yet. Ask Copilot to start a cancel or acquisition journey — then edit every component here.'}
        </p>
      </div>
    )
  }

  const editableSteps = uploaded ? file.steps.filter((s) => s.kind === 'offer') : file.steps
  const audienceLabel = (id: AudienceKey) => AUDIENCE_OPTIONS.find((o) => o.id === id)?.label ?? id
  const shellLabel = (id: ShellLayout) => SHELL_OPTIONS.find((o) => o.id === id)?.label ?? id

  const nameField = (
    <TextField
      label="Journey name"
      value={file.name}
      onCommit={(name) => (name.trim() ? patch(`Rename the journey to ${quoted(name)}.`, { name }) : false)}
    />
  )
  const flow = uploaded ? uploadedScreenChain(file) : templateLabel(file.template)
  const steps = editableSteps.map((step, i) => {
    const meta = KIND_META[step.kind]
    const compiled = compiledSteps.find((c) => c.id === step.id)
    const idx = file.steps.indexOf(step) + 1
    const label = step.kind === 'offer' && step.id === 'entry' ? 'Entry offer' : meta.label
    return (
      <Section
        key={step.id}
        title={page ? label : `${idx}. ${label}`}
        badge={page ? idx : undefined}
        hint={meta.hint}
        defaultOpen={i === 0 && !uploaded}
      >
        <StepEditor fileStep={step} compiled={compiled} title={`step ${idx} (${label})`} />
      </Section>
    )
  })
  const uploadedNote = uploaded && (
    <p className="rounded-[10px] bg-amber-50 px-[12px] py-[8px] text-[11.5px] leading-relaxed text-amber-700">
      Screens come from your uploaded file. You can still edit who sees it, the shell, holdout,
      brand, and the save offer below.
    </p>
  )
  const layoutSection = (
    <Section title={V8 ? 'Layout' : 'Shell'} hint="How it's presented">
      <SelectField
        label={V8 ? 'Layout' : 'Shell'}
        value={file.shell}
        options={SHELL_OPTIONS}
        onChange={(shell) =>
          void patch(`Present it as: ${shellLabel(shell)}.`, { shell }).then((ok) => {
            if (!ok || !V8 || !page) return
            setMark(useWorkspace.getState().activeId, 'layout', 'done', 'summary')
            useCopilotThread.getState().say('bot', `Layout changed in the Summary: ${shellLabel(shell)}`, { note: true })
          })
        }
      />
    </Section>
  )
  const brandSection = (
    <Section title="Brand" hint="Look of the subscriber UI">
      <TextField
        label="Merchant"
        value={file.brand.merchant}
        onCommit={(merchant) =>
          patch(`Change the brand name to ${quoted(merchant)}.`, {
            brand: patchBrandShortcuts(file.brand, { merchant }),
          })
        }
      />
      <ColorField
        label="Primary color"
        value={file.brand.primary}
        onCommit={(primary) =>
          patch(`Change the primary color to ${primary.toUpperCase()}.`, {
            brand: patchBrandShortcuts(file.brand, { primary }),
          })
        }
      />
      <NumberField
        label="Corner radius (px)"
        value={file.brand.corners}
        min={0}
        max={40}
        onCommit={(corners) =>
          patch(`Set the corner radius to ${corners}px.`, {
            brand: patchBrandShortcuts(file.brand, { corners }),
          })
        }
      />
    </Section>
  )

  if (page) {
    return (
      <EditGateCtx.Provider value={gate}>
        <PageCtx.Provider value>
          <div className="space-y-[28px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="px-[16px] py-[14px]">{nameField}</div>
              <div className="border-t border-slate-100 px-[16px] py-[12px]">
                <p className="text-[12px] font-medium text-slate-600">Flow</p>
                <p className="mt-[2px] text-[13px] leading-snug text-slate-800">{flow}</p>
              </div>
            </div>
            <section>
              <PageHeading title="Steps" />
              {uploadedNote && <div className="mb-[8px]">{uploadedNote}</div>}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{steps}</div>
            </section>
            <section>
              <PageHeading title="Look and layout" />
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {layoutSection}
                {brandSection}
              </div>
            </section>
          </div>
        </PageCtx.Provider>
        {pending && <ConfirmDialog what={pending.what} onCancel={cancelPending} onSave={savePending} />}
      </EditGateCtx.Provider>
    )
  }

  return (
    <EditGateCtx.Provider value={gate}>
      <div className="min-h-0 flex-1 space-y-[16px] overflow-y-auto px-[14px] pb-[24px] pt-[12px]">
        {/* Journey header */}
        <div className="space-y-[10px]">
          {nameField}
          <div className="rounded-[10px] bg-slate-50 px-[12px] py-[10px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">Flow</p>
            <p className="mt-[2px] text-[12.5px] leading-snug text-slate-600">{flow}</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-[8px]">
          <p className="px-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Steps
          </p>
          {uploadedNote}
          {steps}
        </div>

        {/* Global knobs */}
        <div className="space-y-[8px]">
          <p className="px-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            {V8 ? 'Look and layout' : <>Targeting &amp; presentation</>}
          </p>
          {!V8 && (
            <Section title="Audience" hint="Who enters this experience">
              <SelectField
                label="Audience"
                value={file.audience}
                options={AUDIENCE_OPTIONS}
                onChange={(audience) => void patch(`Show this experience to ${audienceLabel(audience)}.`, { audience })}
              />
            </Section>
          )}
          {layoutSection}
          {!V8 && <Section title="Holdout" hint="Share that sees no treatment">
            <NumberField
              label="Holdout %"
              value={file.holdout}
              min={0}
              max={50}
              onCommit={(holdout) =>
                patch(
                  holdout === 0 ? 'Turn off the holdout.' : `Set the holdout to ${holdout}%. That share sees no cancel page.`,
                  { holdout },
                )
              }
            />
          </Section>}
          {brandSection}
        </div>
      </div>
      {pending && <ConfirmDialog what={pending.what} onCancel={cancelPending} onSave={savePending} />}
    </EditGateCtx.Provider>
  )
}

