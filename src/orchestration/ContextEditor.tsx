import { useEffect, useState, type ReactNode } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { useJourney } from '../store/useJourney'
import { useExperience } from '../store/useExperience'
import { patchBrandShortcuts } from '../brand/theme'
import { OFFER_VARIANTS } from '../lib/offerVariants'
import { templateLabel } from '../journey/templates'
import { uploadedScreenChain } from '../journey/contextDoc'
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

const SHELL_OPTIONS: { id: ShellLayout; label: string }[] = [
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[4px] block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
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
  onCommit: (v: string) => void
  multiline?: boolean
  placeholder?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => {
    setV(value)
  }, [value])
  const commit = () => {
    if (v !== value) onCommit(v)
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
  onCommit: (next: string[]) => void
  addLabel: string
}) {
  const [rows, setRows] = useState(items)
  useEffect(() => {
    setRows(items)
  }, [items])
  const commit = (next: string[]) => onCommit(next.map((r) => r.trim()).filter(Boolean))
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

function Section({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
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
function StepEditor({ fileStep, compiled }: { fileStep: JourneyStepFile; compiled: Step | undefined }) {
  const updateStep = useJourney((s) => s.updateStep)
  const id = fileStep.id
  const setHeadline = (v: string) => updateStep(id, { headline: v.trim() || undefined })
  const setBody = (v: string) => updateStep(id, { body: v.trim() || undefined })

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
            onCommit={(keepItems) => updateStep(id, { content: { keepItems } })}
          />
          <ListField
            label="What they'll lose"
            items={(c?.loseItems ?? []).map((i) => i.label)}
            addLabel="Add a loss"
            onCommit={(loseItems) => updateStep(id, { content: { loseItems } })}
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
            onCommit={(surveyReasons) => updateStep(id, { content: { surveyReasons } })}
          />
          <TextField
            label="Free-text prompt"
            value={c?.freeTextPrompt ?? ''}
            onCommit={(v) => updateStep(id, { content: { surveyPrompt: v.trim() || undefined } })}
          />
        </>
      )
    }
    case 'offer': {
      const c = comp(compiled, 'offer') as OfferComponent | undefined
      return (
        <>
          <SelectField
            label="Offer type"
            value={(c?.category ?? 'discount') as OfferKey}
            options={OFFER_OPTIONS}
            onChange={(offer) => updateStep(id, { offer, headline: undefined, body: undefined })}
          />
          <TextField label="Headline" value={c?.title ?? ''} onCommit={setHeadline} />
          <TextField label="Description" value={c?.description ?? ''} onCommit={setBody} multiline />
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

/**
 * Structured Context surface — a complete map of the growth workflow. Each step
 * is an expandable component editor; global sections cover who sees it and how
 * it's dressed. Every edit writes to the JourneyFile and recompiles the canvas.
 */
export function ContextEditor() {
  const file = useJourney((s) => s.file)
  const patchFile = useJourney((s) => s.patchFile)
  const compiledSteps = useExperience((s) => s.experience.steps)
  const uploaded = file.source === 'uploaded'

  if (file.steps.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-[24px] text-center">
        <p className="max-w-[260px] text-[13px] leading-relaxed text-slate-400">
          No flow yet. Ask Copilot to start a cancel or acquisition journey — then edit every component here.
        </p>
      </div>
    )
  }

  const editableSteps = uploaded ? file.steps.filter((s) => s.kind === 'offer') : file.steps

  return (
    <div className="min-h-0 flex-1 space-y-[16px] overflow-y-auto px-[14px] pb-[24px] pt-[12px]">
      {/* Journey header */}
      <div className="space-y-[10px]">
        <TextField label="Journey name" value={file.name} onCommit={(name) => patchFile({ name })} />
        <div className="rounded-[10px] bg-slate-50 px-[12px] py-[10px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">Flow</p>
          <p className="mt-[2px] text-[12.5px] leading-snug text-slate-600">
            {uploaded ? uploadedScreenChain(file) : templateLabel(file.template)}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-[8px]">
        <p className="px-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Steps
        </p>
        {uploaded && (
          <p className="rounded-[10px] bg-amber-50 px-[12px] py-[8px] text-[11.5px] leading-relaxed text-amber-700">
            Screens come from your uploaded file. You can still edit who sees it, the shell, holdout,
            brand, and the save offer below.
          </p>
        )}
        {editableSteps.map((step, i) => {
          const meta = KIND_META[step.kind]
          const compiled = compiledSteps.find((c) => c.id === step.id)
          const idx = file.steps.indexOf(step) + 1
          const label = step.kind === 'offer' && step.id === 'entry' ? 'Entry offer' : meta.label
          return (
            <Section key={step.id} title={`${idx}. ${label}`} hint={meta.hint} defaultOpen={i === 0 && !uploaded}>
              <StepEditor fileStep={step} compiled={compiled} />
            </Section>
          )
        })}
      </div>

      {/* Global knobs */}
      <div className="space-y-[8px]">
        <p className="px-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Targeting &amp; presentation
        </p>
        <Section title="Audience" hint="Who enters this experience">
          <SelectField
            label="Audience"
            value={file.audience}
            options={AUDIENCE_OPTIONS}
            onChange={(audience) => patchFile({ audience })}
          />
        </Section>
        <Section title="Shell" hint="How it's presented">
          <SelectField
            label="Shell"
            value={file.shell}
            options={SHELL_OPTIONS}
            onChange={(shell) => patchFile({ shell })}
          />
        </Section>
        <Section title="Holdout" hint="Share that sees no treatment">
          <Field label="Holdout %">
            <input
              type="number"
              min={0}
              max={50}
              value={file.holdout}
              onChange={(e) =>
                patchFile({ holdout: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })
              }
              className={inputCls}
            />
          </Field>
        </Section>
        <Section title="Brand" hint="Look of the subscriber UI">
          <TextField
            label="Merchant"
            value={file.brand.merchant}
            onCommit={(merchant) => patchFile({ brand: patchBrandShortcuts(file.brand, { merchant }) })}
          />
          <Field label="Primary color">
            <div className="flex items-center gap-[8px]">
              <input
                type="color"
                value={file.brand.primary}
                onChange={(e) =>
                  patchFile({ brand: patchBrandShortcuts(file.brand, { primary: e.target.value }) })
                }
                className="h-[32px] w-[40px] flex-none cursor-pointer rounded-[8px] border border-slate-200 bg-white p-[2px]"
              />
              <span className="text-[13px] uppercase text-slate-500">{file.brand.primary}</span>
            </div>
          </Field>
          <Field label="Corner radius (px)">
            <input
              type="number"
              min={0}
              max={40}
              value={file.brand.corners}
              onChange={(e) =>
                patchFile({
                  brand: patchBrandShortcuts(file.brand, {
                    corners: Math.max(0, Math.min(40, Number(e.target.value) || 0)),
                  }),
                })
              }
              className={inputCls}
            />
          </Field>
        </Section>
      </div>
    </div>
  )
}
