import { SButton, SIcon, SSwitch } from '@chargebee/sting-react'
import { useExperience } from '../store/useExperience'
import { uid } from '../lib/id'
import { REASON_CODES } from '../types/experience'
import type {
  ConfirmationComponent,
  ExperienceComponent,
  LossAversionComponent,
  OfferComponent,
  OutcomeComponent,
  PricingTableComponent,
  ShadowLevel,
  SurfaceStyle,
  SurveyComponent,
  SurveyReasonOption,
} from '../types/experience'
import { Field, SelectField, SwitchField, TextField } from './fields'
import { LA_VARIANTS, laVariantOf, laVariantPatch, usedLAVariants, type LAVariant } from '../lib/laVariants'

/*
 * Inspector "Step" editors — STRUCTURE ONLY.
 *
 * Anything a merchant can edit directly on the card (all copy: titles,
 * descriptions, list item text, CTA labels, prompts, stats, impact text …) is
 * intentionally NOT duplicated here. These editors keep only the options that
 * have no inline affordance yet: card variants, presentation, fulfillment,
 * reason codes, follow-ups, severities, outcome config, and add/remove of list
 * rows that can't yet be added inline. Copy for those rows is shown read-only
 * so the merchant still knows which row is which.
 */

function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <SButton size="small" variant="neutral-outline" onClick={onClick} disabled={disabled}>
      {label}
    </SButton>
  )
}

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim()

/** A read-only row that names an inline-edited item and offers structure-only
 * controls (remove, and optionally nested selects/switches). */
function RowShell({
  children,
  onRemove,
  disableRemove,
}: {
  children: React.ReactNode
  onRemove?: () => void
  disableRemove?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">{children}</div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disableRemove}
            className="mt-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-40"
            aria-label="Remove"
          >
            <RemoveIcon />
          </button>
        )}
      </div>
    </div>
  )
}

/** Compact caption + remove for a purely inline-edited list row. */
function CaptionRow({
  label,
  onRemove,
  disableRemove,
}: {
  label: string
  onRemove: () => void
  disableRemove?: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5">
      <span className="flex-1 truncate text-[13px] text-slate-600">{label || '—'}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disableRemove}
        className="flex-none text-slate-300 hover:text-slate-500 disabled:opacity-40"
        aria-label="Remove"
      >
        <RemoveIcon />
      </button>
    </div>
  )
}

/** Native color picker + hex input, matching the Branding panel chips. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
        <label className="relative block h-8 w-9 flex-none cursor-pointer" style={{ background: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          value={value.toUpperCase()}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-full border-l border-slate-200 px-2 py-1.5 text-[13px] uppercase text-slate-600 outline-none"
        />
      </div>
    </Field>
  )
}

const SHADOW_OPTIONS: { value: ShadowLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'Subtle' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Elevated' },
]

const STROKE_WIDTH_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: '1px' },
  { value: '2', label: '2px' },
  { value: '3', label: '3px' },
]

/** Stroke / fill / shadow controls for an editable surface (reason row, offer card). */
function SurfaceStyleControls({
  title,
  style,
  defaults,
  onChange,
}: {
  title: string
  style: SurfaceStyle | undefined
  defaults: Required<SurfaceStyle>
  onChange: (patch: Partial<SurfaceStyle>) => void
}) {
  const s = { ...defaults, ...(style ?? {}) }
  return (
    // No frame of its own: the component card already frames this, and the
    // title only has to say which surface inside the component is being styled.
    <div className="space-y-3">
      <div className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{title}</div>
      <ColorField label="Fill" value={s.fillColor} onChange={(fillColor) => onChange({ fillColor })} />
      <ColorField label="Stroke" value={s.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} />
      <SelectField
        label="Stroke width"
        value={String(s.strokeWidth)}
        options={STROKE_WIDTH_OPTIONS}
        onChange={(v) => onChange({ strokeWidth: Number(v) })}
      />
      <SelectField
        label="Shadow"
        value={s.shadow}
        options={SHADOW_OPTIONS}
        onChange={(shadow) => onChange({ shadow: shadow as ShadowLevel })}
      />
    </div>
  )
}

const SURVEY_OPTION_STYLE_DEFAULTS: Required<SurfaceStyle> = {
  fillColor: '#ffffff',
  strokeColor: '#e2e8f0',
  strokeWidth: 1,
  shadow: 'none',
}

const OFFER_CARD_STYLE_DEFAULTS: Required<SurfaceStyle> = {
  fillColor: '#ffffff',
  strokeColor: '#e6e9ef',
  strokeWidth: 1,
  shadow: 'lg',
}

/** Whether a component draws a surface of its own that can be styled. */
export function hasAppearance(component: ExperienceComponent): boolean {
  if (component.kind === 'offer') return true
  // The other presentations draw no row of their own — a dropdown and a free
  // text box take their look from Brand, so there is nothing here to set.
  return (
    component.kind === 'survey' &&
    (component.presentation === 'radio' || component.presentation === 'inline_reason')
  )
}

/**
 * The appearance half of a component's settings: the surface a subscriber sees.
 *
 * Split from the configuration editors because the two answer different
 * questions — how this should look, versus what it should do — and because only
 * two kinds have a surface at all. `hasAppearance` is what lets the inspector
 * leave the others out instead of showing empty cards.
 */
export function ComponentAppearance({
  stepId,
  component,
}: {
  stepId: string
  component: ExperienceComponent
}) {
  const update = useExperience((s) => s.updateComponent)
  if (!hasAppearance(component)) return null

  switch (component.kind) {
    case 'survey':
      return (
        <SurfaceStyleControls
          title="Reason appearance"
          style={component.optionStyle}
          defaults={SURVEY_OPTION_STYLE_DEFAULTS}
          onChange={(p) =>
            update(stepId, component.id, { optionStyle: { ...component.optionStyle, ...p } })
          }
        />
      )
    case 'offer':
      return (
        <SurfaceStyleControls
          title="Card appearance"
          style={component.cardStyle}
          defaults={OFFER_CARD_STYLE_DEFAULTS}
          onChange={(p) => update(stepId, component.id, { cardStyle: { ...component.cardStyle, ...p } })}
        />
      )
    default:
      return null
  }
}

// --------------------------------------------------------------------------

export function LossAversionEditor({ stepId, component }: { stepId: string; component: LossAversionComponent }) {
  const update = useExperience((s) => s.updateComponent)
  const step = useExperience((s) => s.experience.steps.find((x) => x.id === stepId))
  const patch = (p: Partial<LossAversionComponent>) => update(stepId, component.id, p)

  // A step cannot carry two cards of the same variant — hide the ones already
  // taken by a sibling loss-aversion card.
  const taken = usedLAVariants(step?.components ?? [], component.id)
  const variantOptions = LA_VARIANTS.filter((o) => !taken.has(o.value))

  return (
    <div className="space-y-3">
      <SelectField
        label="Card variant"
        value={laVariantOf(component)}
        onChange={(variant) => patch(laVariantPatch(component, variant as LAVariant))}
        options={variantOptions}
      />

      {component.cardType === 'account_activity' && (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-[12px] font-semibold text-slate-500">Metrics</div>
          <div className="space-y-1.5">
            {(component.stats ?? []).map((s) => (
              <CaptionRow
                key={s.id}
                label={[stripTags(s.value), stripTags(s.label)].filter(Boolean).join(' · ')}
                onRemove={() => patch({ stats: (component.stats ?? []).filter((x) => x.id !== s.id) })}
                disableRemove={(component.stats ?? []).length <= 1}
              />
            ))}
            <AddButton
              label="Add metric"
              onClick={() => patch({ stats: [...(component.stats ?? []), { id: uid('st'), value: '0', label: 'New metric' }] })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------

/**
 * One survey reason: the reason it applies to, the two things a merchant sets
 * on it, then the follow-up as a group of its own.
 *
 * The reason's own copy is edited on the card rather than here, so this quotes
 * it — the same rule the rest of these editors follow. Grouping the follow-up
 * inside its own panel is what stops the toggle reading as a third setting on
 * the reason: it owns the prompt below it, and only that.
 */
function ReasonCard({
  option,
  offers,
  showFollowUp,
  onChange,
}: {
  option: SurveyReasonOption
  offers: OfferComponent[]
  /** inline_reason shares one prompt across every reason, set on the card. */
  showFollowUp: boolean
  onChange: (patch: Partial<SurveyReasonOption>) => void
}) {
  const followUp = option.followUp

  return (
    <div className="space-y-3.5 py-4 first:pt-0 last:pb-0">
      <div className="space-y-2">
        <span className="inline-flex rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2px] text-indigo-600">
          {option.isOther ? 'Other reason' : 'Cancellation reason'}
        </span>
        <div className="text-[15px] font-semibold leading-[1.4] text-slate-900">
          “{stripTags(option.label) || 'Reason'}”
        </div>
      </div>

      {!option.isOther && offers.length > 0 && (
        <SelectField
          label="Link to offer"
          value={option.linkedOfferId ?? ''}
          onChange={(id) => onChange({ linkedOfferId: id || null })}
          options={offers.map((o) => ({ value: o.id, label: stripTags(o.title) || 'Offer' }))}
          placeholder="No linked offer"
          prefix={<SIcon name="tag" size={14} className="text-emerald-500" />}
          clearable
        />
      )}

      {!option.isOther && (
        <SelectField
          label="Reason code"
          value={option.code}
          onChange={(code) => onChange({ code })}
          options={REASON_CODES.map((c) => ({ value: c, label: c }))}
          prefix={<SIcon name="code" size={14} className="text-indigo-500" />}
        />
      )}

      {showFollowUp && (
        <div className="space-y-3.5 rounded-xl border-[1.5px] border-indigo-50 bg-slate-50 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-[13px] font-semibold text-slate-900">Follow-up question</div>
              <div className="text-[11px] leading-snug text-slate-600">
                Prompt user for qualitative feedback
              </div>
            </div>
            <SSwitch
              aria-label="Follow-up question"
              checked={!!followUp?.enabled}
              onCheckedChange={(on) =>
                onChange({
                  followUp: on ? { enabled: true, prompt: 'Tell us more', optional: true } : null,
                })
              }
            />
          </div>
          {followUp?.enabled && (
            <TextField
              label="Follow-up prompt"
              value={followUp.prompt}
              onChange={(prompt) => onChange({ followUp: { ...followUp, prompt } })}
              trailingIcon="square-pen"
            />
          )}
        </div>
      )}
    </div>
  )
}

export function SurveyEditor({ stepId, component }: { stepId: string; component: SurveyComponent }) {
  const update = useExperience((s) => s.updateComponent)
  const steps = useExperience((s) => s.experience.steps)
  const patch = (p: Partial<SurveyComponent>) => update(stepId, component.id, p)

  const stepIndex = steps.findIndex((s) => s.id === stepId)
  const laterOffers = steps
    .slice(stepIndex + 1)
    .flatMap((s) => s.components)
    .filter((c): c is OfferComponent => c.kind === 'offer')

  const replaceOption = (id: string, patchOpt: Partial<SurveyComponent['options'][number]>) =>
    patch({ options: component.options.map((o) => (o.id === id ? { ...o, ...patchOpt } : o)) })

  return (
    <div className="space-y-3">
      <SelectField
        label="Presentation"
        value={component.presentation}
        onChange={(presentation) => patch({ presentation })}
        options={[
          { value: 'radio', label: 'Radio buttons' },
          { value: 'inline_reason', label: 'Inline reasoning (fade + follow-up)' },
          { value: 'dropdown', label: 'Dropdown' },
          { value: 'free_text', label: 'Free text' },
        ]}
      />

      {component.presentation !== 'free_text' && (
        <>
          <SwitchField
            label="Randomize order"
            description={'"Other" stays pinned last when randomizing.'}
            checked={component.randomize}
            onChange={(randomize) => patch({ randomize })}
          />
          {/* Not a <Field>: one label cannot own this many inputs, and the
              reasons read as a list of their own rather than one setting. */}
          <div className="space-y-1">
            <div className="text-[12px] font-semibold text-slate-600">Reason settings</div>
            <div className="divide-y divide-slate-200/80">
              {component.options.map((opt) => (
                <ReasonCard
                  key={opt.id}
                  option={opt}
                  offers={laterOffers}
                  showFollowUp={component.presentation !== 'inline_reason'}
                  onChange={(patchOpt) => replaceOption(opt.id, patchOpt)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------

const OFFER_CATEGORIES: { value: OfferComponent['category']; label: string }[] = [
  { value: 'discount', label: 'Discount' },
  { value: 'plan_change', label: 'Plan change' },
  { value: 'addon', label: 'Add-on' },
  { value: 'one_time_charge', label: 'One-time charge' },
  { value: 'skip', label: 'Skip' },
  { value: 'extension', label: 'Extension' },
  { value: 'pause', label: 'Pause' },
  { value: 'support_train', label: 'Support & Training' },
  { value: 'product_feedback', label: 'Product feedback' },
  { value: 'multi_action', label: 'Multi-action' },
]

export function OfferEditor({ stepId, component }: { stepId: string; component: OfferComponent }) {
  const update = useExperience((s) => s.updateComponent)
  const patch = (p: Partial<OfferComponent>) => update(stepId, component.id, p)

  return (
    <div className="space-y-3">
      <SelectField label="Category" value={component.category} onChange={(category) => patch({ category })} options={OFFER_CATEGORIES} />
      <SelectField
        label="Fulfillment"
        value={component.fulfillment}
        onChange={(fulfillment) => patch({ fulfillment })}
        options={[
          { value: 'billing', label: 'Billing integration' },
          { value: 'checkout', label: 'Checkout (opens in flow)' },
          { value: 'url', label: 'URL redirect' },
          { value: 'webhook', label: 'Webhook' },
          { value: 'email', label: 'Email' },
        ]}
      />
      <SwitchField
        label="Reason-linked"
        description="Must sit on a step after the survey."
        checked={component.reasonLinked}
        onChange={(reasonLinked) => patch({ reasonLinked })}
      />
      <SwitchField
        label="Require consent checkbox"
        description="Subscriber must accept before claiming the offer."
        checked={!!component.consentEnabled}
        onChange={(consentEnabled) => {
          if (consentEnabled && !component.consentStatement) {
            patch({
              consentEnabled,
              consentStatement:
                'I understand this offer replaces my current plan and agree to the updated terms.',
            })
          } else {
            patch({ consentEnabled })
          }
        }}
      />
      <p className="text-[11px] leading-relaxed text-slate-400">
        A standalone offer includes media (upload it on the card, swap sides with the ⇄ control). Adding a second offer removes media from both.
      </p>
    </div>
  )
}

// --------------------------------------------------------------------------

export function PricingTableEditor({ stepId, component }: { stepId: string; component: PricingTableComponent }) {
  const update = useExperience((s) => s.updateComponent)
  const patch = (p: Partial<PricingTableComponent>) => update(stepId, component.id, p)

  return (
    <div className="space-y-3">
      <SelectField
        label="Fulfillment"
        value={component.fulfillment}
        onChange={(fulfillment) => patch({ fulfillment })}
        options={[
          { value: 'checkout', label: 'Checkout (opens in flow)' },
          { value: 'url', label: 'URL redirect' },
        ]}
      />
      <Field label="Plans">
        <div className="space-y-2">
          {component.plans.map((plan) => (
            <RowShell
              key={plan.id}
              onRemove={() => patch({ plans: component.plans.filter((p) => p.id !== plan.id) })}
              disableRemove={component.plans.length <= 1}
            >
              <div className="text-[12px] font-semibold text-slate-500">{stripTags(plan.name) || 'Plan'}</div>
              <TextField
                label="Cadence"
                value={plan.cadence}
                onChange={(cadence) => patch({ plans: component.plans.map((p) => (p.id === plan.id ? { ...p, cadence } : p)) })}
              />
              <SwitchField
                label="Recommended"
                checked={!!plan.highlighted}
                onChange={(highlighted) => patch({ plans: component.plans.map((p) => (p.id === plan.id ? { ...p, highlighted } : p)) })}
              />
            </RowShell>
          ))}
          <AddButton
            label="Add plan"
            onClick={() =>
              patch({
                plans: [...component.plans, { id: uid('pl'), name: 'New plan', price: '$0', cadence: '/mo', features: ['Feature'], ctaLabel: 'Choose plan' }],
              })
            }
          />
        </div>
      </Field>
    </div>
  )
}

// --------------------------------------------------------------------------

export function ConfirmationEditor({ stepId, component }: { stepId: string; component: ConfirmationComponent }) {
  const update = useExperience((s) => s.updateComponent)
  const patch = (p: Partial<ConfirmationComponent>) => update(stepId, component.id, p)

  return (
    <div className="space-y-3">
      <SelectField
        label="Confirmation variant"
        value={component.variant}
        onChange={(variant) => patch({ variant })}
        options={[
          { value: 'simple', label: 'Message + benefits' },
          { value: 'consent', label: 'Message + consent statement' },
          { value: 'type_confirm', label: 'Message + type to confirm' },
        ]}
      />
      {component.variant === 'type_confirm' && (
        <TextField label="Keyword" value={component.confirmKeyword ?? ''} onChange={(confirmKeyword) => patch({ confirmKeyword })} />
      )}
    </div>
  )
}

// --------------------------------------------------------------------------

export function OutcomeEditor({ stepId, component }: { stepId: string; component: OutcomeComponent }) {
  const update = useExperience((s) => s.updateComponent)
  const patch = (p: Partial<OutcomeComponent>) => update(stepId, component.id, p)

  return (
    <div className="space-y-3">
      <SelectField
        label="Outcome variant"
        value={component.variant}
        onChange={(variant) => patch({ variant })}
        options={[
          { value: 'reactivation', label: 'Sad to see you go + reactivation offer' },
          { value: 'feedback', label: 'Sad to see you go + feedback input' },
          { value: 'success', label: 'Success message' },
        ]}
      />
      <p className="text-[11px] leading-relaxed text-slate-400">
        Edit the headline, message{component.variant === 'reactivation' ? ' and restore CTA' : component.variant === 'feedback' ? ' and feedback prompt' : ''} directly on the card.
      </p>
    </div>
  )
}
