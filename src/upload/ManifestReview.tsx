import { useState, type ReactNode } from 'react'
import { uid } from '../lib/id'
import { useJourney } from '../store/useJourney'
import { stepsWithSettings } from './apply'
import {
  OFFER_KIND_LABELS,
  PROCESSING_LABELS,
  QUESTION_LABELS,
  actionNeedsDuration,
  actionNeedsSubcategory,
  blankOffer,
  cloneLossCard,
  offerAction,
  offerGaps,
  reasonBinds,
  settingsForManifest,
  type DiscountBasis,
  type LossCard,
  type ManifestOffer,
  type ManifestSettings,
  type MaxRedemptions,
  type OfferAction,
  type OfferButton,
  type OfferKind,
  type OfferProcessing,
  type PauseMode,
  type SimpleOfferKind,
} from './manifestSettings'
import { SurveyReasonsEditor } from './SurveyReasonsEditor'

const inputClass =
  'w-full border border-slate-200 bg-white px-[8px] py-[6px] text-[13px] text-slate-800 outline-none focus:border-slate-400 disabled:bg-slate-50'
const labelClass = 'mb-[4px] block text-[12px] font-semibold text-slate-600'
const SIMPLE_KINDS = (Object.keys(OFFER_KIND_LABELS) as OfferKind[]).filter(
  (kind): kind is SimpleOfferKind => kind !== 'multi_offer' && kind !== 'multi_action',
)

function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir
  if (next < 0 || next >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(index, 1)
  copy.splice(next, 0, item)
  return copy
}

function commitSettings(settings: ManifestSettings) {
  const file = useJourney.getState().file
  if (!file.manifest || file.manifest.confirmed) return
  useJourney.getState().patchFile({
    manifest: { ...file.manifest, settings, surveyReasons: reasonBinds(settings) },
    steps: stepsWithSettings(file.steps, settings),
  })
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

function TextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <input className={inputClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}

function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-[8px] text-[13px] text-slate-700">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

function SelectField({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <select className={inputClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

function ClosedList({ label, required, emptyLabel = 'Select' }: { label: string; required?: boolean; emptyLabel?: string }) {
  return (
    <Field label={label}>
      <select className={inputClass} value="" disabled>
        <option value="">{emptyLabel}</option>
      </select>
      <p className="mt-[4px] text-[12px] text-slate-500">
        {required ? 'Required. ' : ''}This option list is not in the configuration.
      </p>
    </Field>
  )
}

function Lines({
  items,
  disabled,
  onChange,
}: {
  items: string[]
  disabled: boolean
  onChange: (items: string[]) => void
}) {
  return (
    <div className="space-y-[6px]">
      {items.map((item, index) => (
        <div key={`${index}-${item}`} className="flex gap-[6px]">
          <input
            className={inputClass}
            value={item}
            disabled={disabled}
            onChange={(event) => onChange(items.map((row, i) => (i === index ? event.target.value : row)))}
          />
          <button type="button" className="text-[12px] text-slate-500" disabled={disabled || index === 0} onClick={() => onChange(move(items, index, -1))}>
            Up
          </button>
          <button
            type="button"
            className="text-[12px] text-slate-500"
            disabled={disabled || index === items.length - 1}
            onClick={() => onChange(move(items, index, 1))}
          >
            Down
          </button>
          <button type="button" className="text-[12px] text-slate-500" disabled={disabled} onClick={() => onChange(items.filter((_, i) => i !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="text-[12.5px] font-semibold text-slate-700" disabled={disabled} onClick={() => onChange([...items, ''])}>
        Add
      </button>
    </div>
  )
}

function editSelectedCard(settings: ManifestSettings, recipe: (card: LossCard) => LossCard): ManifestSettings {
  const cards = settings.lossAversion.cards
  const index = cards.findIndex((card) => card.id === settings.lossAversion.selectedId)
  if (index < 0) return settings
  const current = cards[index]
  if (!current.shared) {
    return {
      ...settings,
      lossAversion: {
        ...settings.lossAversion,
        cards: cards.map((card, i) => (i === index ? recipe(card) : card)),
      },
    }
  }
  const copy = recipe(cloneLossCard(current))
  return {
    ...settings,
    lossAversion: { ...settings.lossAversion, selectedId: copy.id, cards: [...cards, copy] },
  }
}

function ActionFields({
  action,
  title,
  lockedKind,
  disabled,
  onChange,
}: {
  action: OfferAction
  title: string
  lockedKind: boolean
  disabled: boolean
  onChange: (action: OfferAction) => void
}) {
  const showDuration = action.kind === 'extension' || (action.kind === 'pause_skip' && action.pauseMode !== '')
  return (
    <div className="space-y-[10px]">
      <p className="text-[12.5px] font-semibold text-slate-800">{title}</p>
      {lockedKind ? (
        <p className="text-[13px] text-slate-700">Button action: {OFFER_KIND_LABELS[action.kind]}</p>
      ) : (
        <SelectField
          label="Category"
          value={action.kind}
          disabled={disabled}
          options={SIMPLE_KINDS.map((kind) => ({ value: kind, label: OFFER_KIND_LABELS[kind] }))}
          onChange={(kind) => onChange(offerAction(kind as SimpleOfferKind, { processing: action.processing }))}
        />
      )}
      {action.kind === 'discount' && (
        <SelectField
          label="Discount option"
          value={action.discountBasis}
          disabled={disabled}
          options={[
            { value: '', label: 'Select' },
            { value: 'percent', label: '% based discount' },
            { value: 'amount', label: '$ based discount' },
            { value: 'quantity', label: 'Quantity based discount' },
          ]}
          onChange={(value) => onChange({ ...action, discountBasis: value as DiscountBasis | '' })}
        />
      )}
      {action.kind === 'pause_skip' && (
        <SelectField
          label="Action"
          value={action.pauseMode}
          disabled={disabled}
          options={[
            { value: '', label: 'Select' },
            { value: 'indefinite', label: 'Pause (Indefinitely)' },
            { value: 'skip_cycles', label: 'Skip (billing cycles)' },
            { value: 'custom', label: 'Pause (custom duration)' },
          ]}
          onChange={(value) => onChange({ ...action, pauseMode: value as PauseMode | '' })}
        />
      )}
      {action.kind === 'extension' && <p className="text-[13px] text-slate-700">Extend Renewal Dates</p>}
      {showDuration && (
        <div className="grid grid-cols-2 gap-[10px]">
          <ClosedList label="Duration" required={actionNeedsDuration(action)} />
          <ClosedList label="Interval" />
        </div>
      )}
      {actionNeedsSubcategory(action.kind) && <ClosedList label="Subcategory" required emptyLabel="None" />}
      {action.kind === 'subscription_change' && (
        <div className="space-y-[8px]">
          <Check
            label="Add discount"
            checked={action.addDiscount}
            disabled={disabled}
            onChange={(addDiscount) => onChange({ ...action, addDiscount })}
          />
          {action.addDiscount && (
            <SelectField
              label="Added discount"
              value={action.addedDiscountBasis}
              disabled={disabled}
              options={[
                { value: '', label: 'Select' },
                { value: 'percent', label: '% based discount' },
                { value: 'amount', label: '$ based discount' },
                { value: 'quantity', label: 'Quantity based discount' },
              ]}
              onChange={(value) => onChange({ ...action, addedDiscountBasis: value as DiscountBasis | '' })}
            />
          )}
        </div>
      )}
      {action.kind === 'one_time' && (
        <p className="text-[12.5px] text-slate-500">Bills an active one-time-charge item immediately or at end of term. No timing control is shown.</p>
      )}
      <SelectField
        label="Offer processing"
        value={action.processing}
        disabled={disabled}
        options={(Object.keys(PROCESSING_LABELS) as OfferProcessing[]).map((key) => ({ value: key, label: PROCESSING_LABELS[key] }))}
        onChange={(processing) => onChange({ ...action, processing: processing as OfferProcessing })}
      />
      {action.processing !== 'url' && (
        <p className="text-[12px] text-slate-500">Destination fields for {PROCESSING_LABELS[action.processing]} are not in the configuration.</p>
      )}
    </div>
  )
}

function ButtonFields({
  button,
  index,
  named,
  lockedKind,
  disabled,
  onChange,
}: {
  button: OfferButton
  index: number
  named: boolean
  lockedKind: boolean
  disabled: boolean
  onChange: (button: OfferButton) => void
}) {
  const prefix = named ? `Button ${index + 1}` : 'Button'
  return (
    <div className="space-y-[12px] border border-slate-100 px-[12px] py-[12px]">
      <TextField label={`${prefix} label`} value={button.buttonLabel} disabled={disabled} onChange={(buttonLabel) => onChange({ ...button, buttonLabel })} />
      <div>
        <p className="mb-[8px] text-[12px] font-bold uppercase tracking-wide text-slate-400">Settings</p>
        <ActionFields
          action={button.action}
          title={prefix}
          lockedKind={lockedKind}
          disabled={disabled}
          onChange={(action) =>
            onChange({
              ...button,
              action,
              successAction: action.kind === 'cancel_nevermind' ? 'nevermind' : 'link',
            })
          }
        />
      </div>
      <div className="space-y-[8px]">
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Accept step</p>
        <p className="text-[13px] text-slate-700">Success action: {button.successAction === 'nevermind' ? 'Nevermind' : 'Link'}</p>
        <p className="text-[13px] text-slate-700">Link destination: URL</p>
        <TextField
          label="Destination URL"
          value={button.destinationUrl}
          disabled={disabled}
          onChange={(destinationUrl) => onChange({ ...button, destinationUrl })}
        />
      </div>
    </div>
  )
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value)
}

function OfferCard({
  offer,
  disabled,
  onChange,
  onRemove,
}: {
  offer: ManifestOffer
  disabled: boolean
  onChange: (offer: ManifestOffer) => void
  onRemove: () => void
}) {
  const gaps = offerGaps(offer)
  const lockedKind = offer.kind !== 'multi_offer' && offer.kind !== 'multi_action'
  return (
    <article className="space-y-[12px] border border-slate-200 px-[12px] py-[12px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0 flex-1 space-y-[8px]">
          <TextField label="Offer name" value={offer.name} disabled={disabled} onChange={(name) => onChange({ ...offer, name })} />
          <TextField label="Variant" value={offer.variantLabel} disabled={disabled} onChange={(variantLabel) => onChange({ ...offer, variantLabel })} />
        </div>
        <button type="button" className="text-[12px] text-slate-500" disabled={disabled} onClick={onRemove}>
          Remove
        </button>
      </div>
      {gaps.length > 0 && <p className="text-[12.5px] text-amber-800">Incomplete. Finish {gaps.join(', ')}.</p>}
      <SelectField
        label="Type"
        value={offer.kind}
        disabled={disabled}
        options={(Object.keys(OFFER_KIND_LABELS) as OfferKind[]).map((kind) => ({ value: kind, label: OFFER_KIND_LABELS[kind] }))}
        onChange={(kind) => {
          const next = blankOffer(kind as OfferKind, 1)
          onChange({ ...next, id: offer.id, name: offer.name })
        }}
      />
      <div>
        <p className="mb-[8px] text-[12px] font-bold uppercase tracking-wide text-slate-400">Layout</p>
        <SelectField
          label="Preview layout"
          value={offer.layout}
          disabled={disabled}
          options={[
            { value: 'regular', label: 'Regular' },
            { value: 'horizontal', label: 'Horizontal' },
          ]}
          onChange={(layout) => onChange({ ...offer, layout: layout as ManifestOffer['layout'] })}
        />
        <div className="mt-[8px] space-y-[8px]">
          <TextField label="Preview headline" value={offer.headline} disabled={disabled} onChange={(headline) => onChange({ ...offer, headline })} />
          <TextField label="Preview body" value={offer.body} disabled={disabled} onChange={(body) => onChange({ ...offer, body })} />
        </div>
      </div>
      <SelectField
        label="Brand scope"
        value={offer.brandScope}
        disabled={disabled}
        options={[
          { value: 'this_brand', label: 'Only this brand' },
          { value: 'all_brands', label: 'All brands' },
        ]}
        onChange={(brandScope) => onChange({ ...offer, brandScope: brandScope as ManifestOffer['brandScope'] })}
      />
      {offer.buttons.map((button, index) => (
        <ButtonFields
          key={`${offer.id}-button-${index}`}
          button={button}
          index={index}
          named={offer.kind === 'multi_offer'}
          lockedKind={lockedKind}
          disabled={disabled}
          onChange={(next) => onChange({ ...offer, buttons: offer.buttons.map((item, i) => (i === index ? next : item)) })}
        />
      ))}
      {offer.kind === 'multi_action' && offer.secondAction && (
        <div className="border border-slate-100 px-[12px] py-[12px]">
          <ActionFields
            action={offer.secondAction}
            title="Button action 2"
            lockedKind={false}
            disabled={disabled}
            onChange={(secondAction) => onChange({ ...offer, secondAction })}
          />
        </div>
      )}
      <div className="space-y-[8px]">
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Card</p>
        <div className="flex items-end gap-[8px]">
          <div className="flex-1">
            <TextField label="Card name" value={offer.cardName} disabled={disabled} onChange={(cardName) => onChange({ ...offer, cardName })} />
          </div>
          <button type="button" className="mb-[2px] text-[12px] font-semibold text-slate-600" onClick={() => copyText(offer.cardName)}>
            Copy
          </button>
        </div>
        <div className="flex items-end gap-[8px]">
          <div className="flex-1">
            <TextField label="Offer name" value={offer.offerName} disabled={disabled} onChange={(offerName) => onChange({ ...offer, offerName })} />
          </div>
          <button type="button" className="mb-[2px] text-[12px] font-semibold text-slate-600" onClick={() => copyText(offer.offerName)}>
            Copy
          </button>
        </div>
        <SelectField
          label="Max redemptions"
          value={offer.maxRedemptions}
          disabled={disabled}
          options={(['unlimited', '1', '2', '3', '4', '5'] as MaxRedemptions[]).map((value) => ({
            value,
            label: value === 'unlimited' ? 'Unlimited' : value,
          }))}
          onChange={(maxRedemptions) => onChange({ ...offer, maxRedemptions: maxRedemptions as MaxRedemptions })}
        />
      </div>
    </article>
  )
}

function Group({
  title,
  summary,
  open,
  readOnly,
  onToggle,
  children,
}: {
  title: string
  summary: string
  open: boolean
  readOnly: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-[12px] px-[16px] py-[12px]">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
          {!open && <p className="mt-[2px] truncate text-[12.5px] text-slate-500">{summary}</p>}
        </div>
        <button type="button" className="flex-none text-[12.5px] font-semibold text-slate-700" onClick={onToggle}>
          {open ? 'Close' : readOnly ? 'View' : 'Edit'}
        </button>
      </header>
      {open && <div className="space-y-[14px] border-t border-slate-100 px-[16px] py-[14px]">{children}</div>}
    </section>
  )
}

/** Collapsed review of every survey, loss-aversion, and offer setting on the manifesto. */
export function ManifestReview({ readOnly }: { readOnly: boolean }) {
  const manifest = useJourney((s) => s.file.manifest)
  const [open, setOpen] = useState<string | null>(null)
  if (!manifest) return null
  const settings = manifest.settings ?? settingsForManifest(manifest)
  const disabled = readOnly
  const update = (next: ManifestSettings) => {
    if (disabled) return
    commitSettings(next)
  }
  const survey = settings.survey
  const selectedCount = survey.reasons.filter((row) => row.selected).length
  const loss = settings.lossAversion
  const card = loss.cards.find((item) => item.id === loss.selectedId)
  return (
    <div className="space-y-[12px]">
      <Group
        title="Survey reasons"
        summary={`${selectedCount} of ${survey.reasons.length} selected · Random · ${survey.offerStrategy === 'page' ? 'Page based offer' : 'Reason based offer'}`}
        open={open === 'survey'}
        readOnly={readOnly}
        onToggle={() => setOpen(open === 'survey' ? null : 'survey')}
      >
        <SurveyReasonsEditor settings={settings} disabled={disabled} update={update} />
      </Group>

      <Group
        title="Additional survey questions"
        summary={survey.sectionOrder.map((block) => QUESTION_LABELS[block]).join(' · ')}
        open={open === 'questions'}
        readOnly={readOnly}
        onToggle={() => setOpen(open === 'questions' ? null : 'questions')}
      >
        {survey.sectionOrder.map((block, index) => (
          <div key={block} className="border border-slate-100 px-[10px] py-[10px]">
            <div className="mb-[8px] flex items-center justify-between">
              <p className="text-[13px] font-semibold text-slate-800">{QUESTION_LABELS[block]}</p>
              <span className="flex gap-[8px]">
                <button type="button" className="text-[12px] text-slate-500" disabled={disabled || index === 0} onClick={() => update({ ...settings, survey: { ...survey, sectionOrder: move(survey.sectionOrder, index, -1) } })}>
                  Up
                </button>
                <button
                  type="button"
                  className="text-[12px] text-slate-500"
                  disabled={disabled || index === survey.sectionOrder.length - 1}
                  onClick={() => update({ ...settings, survey: { ...survey, sectionOrder: move(survey.sectionOrder, index, 1) } })}
                >
                  Down
                </button>
              </span>
            </div>
            {block === 'reasons' && <p className="text-[12.5px] text-slate-500">Reason catalog is edited in Survey reasons.</p>}
            {block === 'competitors' && (
              <div className="space-y-[8px]">
                <div className="flex flex-wrap gap-x-[16px] gap-y-[8px]">
                  <Check label="Enabled" checked={survey.competitors.enabled} disabled={disabled} onChange={(enabled) => update({ ...settings, survey: { ...survey, competitors: { ...survey.competitors, enabled } } })} />
                  <Check label="Required" checked={survey.competitors.required} disabled={disabled} onChange={(required) => update({ ...settings, survey: { ...survey, competitors: { ...survey.competitors, required } } })} />
                  <Check label="Freeform entry" checked={survey.competitors.freeform} disabled={disabled} onChange={(freeform) => update({ ...settings, survey: { ...survey, competitors: { ...survey.competitors, freeform } } })} />
                </div>
                <TextField label="Label" value={survey.competitors.label} disabled={disabled} onChange={(label) => update({ ...settings, survey: { ...survey, competitors: { ...survey.competitors, label } } })} />
                <SelectField
                  label="Competitor ordering"
                  value={survey.competitors.order}
                  disabled={disabled}
                  options={[
                    { value: 'list', label: 'Same order as in the list' },
                    { value: 'random', label: 'Random' },
                  ]}
                  onChange={(order) => update({ ...settings, survey: { ...survey, competitors: { ...survey.competitors, order: order as 'list' | 'random' } } })}
                />
                <Field label="Competitor options">
                  <Lines
                    items={survey.competitors.options.map((option) => option.label)}
                    disabled={disabled}
                    onChange={(labels) =>
                      update({
                        ...settings,
                        survey: {
                          ...survey,
                          competitors: {
                            ...survey.competitors,
                            options: labels.map((label, i) => ({ id: survey.competitors.options[i]?.id ?? uid('cmp'), label })),
                          },
                        },
                      })
                    }
                  />
                </Field>
                <TextField label="Select placeholder" value={survey.competitors.inputPlaceholder} disabled={disabled} onChange={(inputPlaceholder) => update({ ...settings, survey: { ...survey, competitors: { ...survey.competitors, inputPlaceholder } } })} />
                <TextField label="Other placeholder" value={survey.competitors.otherPlaceholder} disabled={disabled} onChange={(otherPlaceholder) => update({ ...settings, survey: { ...survey, competitors: { ...survey.competitors, otherPlaceholder } } })} />
              </div>
            )}
            {block === 'return' && (
              <div className="space-y-[8px]">
                <div className="flex flex-wrap gap-x-[16px] gap-y-[8px]">
                  <Check label="Enabled" checked={survey.returnLikelihood.enabled} disabled={disabled} onChange={(enabled) => update({ ...settings, survey: { ...survey, returnLikelihood: { ...survey.returnLikelihood, enabled } } })} />
                  <Check label="Required" checked={survey.returnLikelihood.required} disabled={disabled} onChange={(required) => update({ ...settings, survey: { ...survey, returnLikelihood: { ...survey.returnLikelihood, required } } })} />
                </div>
                <TextField label="Label" value={survey.returnLikelihood.label} disabled={disabled} onChange={(label) => update({ ...settings, survey: { ...survey, returnLikelihood: { ...survey.returnLikelihood, label } } })} />
                <div className="grid grid-cols-2 gap-[10px]">
                  <TextField label="Low-end text" value={survey.returnLikelihood.lowText} disabled={disabled} onChange={(lowText) => update({ ...settings, survey: { ...survey, returnLikelihood: { ...survey.returnLikelihood, lowText } } })} />
                  <TextField label="High-end text" value={survey.returnLikelihood.highText} disabled={disabled} onChange={(highText) => update({ ...settings, survey: { ...survey, returnLikelihood: { ...survey.returnLikelihood, highText } } })} />
                </div>
                <p className="text-[12.5px] text-slate-500">Scale: 1–{survey.returnLikelihood.scale}</p>
              </div>
            )}
            {block === 'feedback' && (
              <div className="space-y-[8px]">
                <div className="flex flex-wrap gap-x-[16px] gap-y-[8px]">
                  <Check label="Enabled" checked={survey.feedback.enabled} disabled={disabled} onChange={(enabled) => update({ ...settings, survey: { ...survey, feedback: { ...survey.feedback, enabled } } })} />
                  <Check label="Required" checked={survey.feedback.required} disabled={disabled} onChange={(required) => update({ ...settings, survey: { ...survey, feedback: { ...survey.feedback, required } } })} />
                </div>
                <TextField label="Label" value={survey.feedback.label} disabled={disabled} onChange={(label) => update({ ...settings, survey: { ...survey, feedback: { ...survey.feedback, label } } })} />
                <TextField label="Input placeholder" value={survey.feedback.placeholder} disabled={disabled} onChange={(placeholder) => update({ ...settings, survey: { ...survey, feedback: { ...survey.feedback, placeholder } } })} />
              </div>
            )}
          </div>
        ))}
      </Group>

      <Group
        title="Loss aversion card"
        summary={loss.enabled && card ? `${card.name}${card.shared ? ' · Shared' : ' · Local'}` : 'Not on this page'}
        open={open === 'loss'}
        readOnly={readOnly}
        onToggle={() => setOpen(open === 'loss' ? null : 'loss')}
      >
        <Check label="Show loss-aversion card" checked={loss.enabled} disabled={disabled} onChange={(enabled) => update({ ...settings, lossAversion: { ...loss, enabled } })} />
        <SelectField
          label="Card"
          value={loss.selectedId ?? ''}
          disabled={disabled}
          options={[{ value: '', label: 'None' }, ...loss.cards.map((item) => ({ value: item.id, label: item.shared ? `${item.name} (Shared)` : item.name }))]}
          onChange={(selectedId) => update({ ...settings, lossAversion: { ...loss, selectedId: selectedId || null, enabled: selectedId ? loss.enabled : false } })}
        />
        <div className="flex gap-[12px]">
          <button
            type="button"
            className="text-[12.5px] font-semibold text-slate-700"
            disabled={disabled}
            onClick={() => {
              const created: LossCard = {
                id: uid('card'),
                shared: false,
                name: 'New loss-aversion card',
                title: '',
                keep: [],
                lose: [],
                stats: [
                  { id: uid('stat'), label: 'Saved Revenue', value: '', enabled: true },
                  { id: uid('stat'), label: 'Revenue at Risk', value: '', enabled: true },
                  { id: uid('stat'), label: 'Saved Customers', value: '', enabled: true },
                  { id: uid('stat'), label: 'Monthly Sessions', value: '', enabled: true },
                ],
              }
              update({ ...settings, lossAversion: { enabled: true, selectedId: created.id, cards: [...loss.cards, created] } })
            }}
          >
            Create card
          </button>
          <button
            type="button"
            className="text-[12.5px] font-semibold text-slate-700"
            disabled={disabled || !card}
            onClick={() => {
              if (!card) return
              if (!card.shared) return
              const copy = cloneLossCard(card)
              update({ ...settings, lossAversion: { ...loss, selectedId: copy.id, cards: [...loss.cards, copy] } })
            }}
          >
            Edit as a page copy
          </button>
          <button
            type="button"
            className="text-[12.5px] font-semibold text-slate-700"
            disabled={disabled || !card}
            onClick={() => {
              if (!card) return
              update({
                ...settings,
                lossAversion: {
                  ...loss,
                  selectedId: null,
                  cards: card.shared ? loss.cards : loss.cards.filter((item) => item.id !== card.id),
                },
              })
            }}
          >
            Remove from page
          </button>
        </div>
        {card && (
          <div className="space-y-[10px]">
            {card.shared && <p className="text-[12.5px] text-slate-500">Shared library card. Editing copies it onto this page.</p>}
            <TextField
              label="Internal name"
              value={card.name}
              disabled={disabled}
              onChange={(name) => update(editSelectedCard(settings, (current) => ({ ...current, name })))}
            />
            <TextField
              label="Subscriber title"
              value={card.title}
              disabled={disabled}
              onChange={(title) => update(editSelectedCard(settings, (current) => ({ ...current, title })))}
            />
            <Field label="Keep">
              <Lines items={card.keep} disabled={disabled} onChange={(keep) => update(editSelectedCard(settings, (current) => ({ ...current, keep })))} />
            </Field>
            <Field label="Lose">
              <Lines items={card.lose} disabled={disabled} onChange={(lose) => update(editSelectedCard(settings, (current) => ({ ...current, lose })))} />
            </Field>
            <div className="space-y-[8px]">
              <p className={labelClass}>Stats</p>
              {card.stats.map((stat, index) => (
                <div key={stat.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-[6px]">
                  <input
                    className={inputClass}
                    value={stat.label}
                    disabled={disabled}
                    onChange={(event) =>
                      update(
                        editSelectedCard(settings, (current) => ({
                          ...current,
                          stats: current.stats.map((row) => (row.id === stat.id ? { ...row, label: event.target.value } : row)),
                        })),
                      )
                    }
                  />
                  <input
                    className={inputClass}
                    value={stat.value}
                    disabled={disabled}
                    placeholder="Value"
                    onChange={(event) =>
                      update(
                        editSelectedCard(settings, (current) => ({
                          ...current,
                          stats: current.stats.map((row) => (row.id === stat.id ? { ...row, value: event.target.value } : row)),
                        })),
                      )
                    }
                  />
                  <Check
                    label="On"
                    checked={stat.enabled}
                    disabled={disabled}
                    onChange={(enabled) =>
                      update(
                        editSelectedCard(settings, (current) => ({
                          ...current,
                          stats: current.stats.map((row) => (row.id === stat.id ? { ...row, enabled } : row)),
                        })),
                      )
                    }
                  />
                  <span className="flex gap-[6px]">
                    <button type="button" className="text-[12px] text-slate-500" disabled={disabled || index === 0} onClick={() => update(editSelectedCard(settings, (current) => ({ ...current, stats: move(current.stats, index, -1) })))}>
                      Up
                    </button>
                    <button type="button" className="text-[12px] text-slate-500" disabled={disabled || index === card.stats.length - 1} onClick={() => update(editSelectedCard(settings, (current) => ({ ...current, stats: move(current.stats, index, 1) })))}>
                      Down
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Group>

      <Group
        title="Offers"
        summary={
          settings.offers.length
            ? `${settings.offers.length} ${settings.offers.length === 1 ? 'offer' : 'offers'} · ${settings.offers.filter((item) => offerGaps(item).length > 0).length} incomplete`
            : 'No offers'
        }
        open={open === 'offers'}
        readOnly={readOnly}
        onToggle={() => setOpen(open === 'offers' ? null : 'offers')}
      >
        <div className="space-y-[12px]">
          {settings.offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              disabled={disabled}
              onChange={(next) => update({ ...settings, offers: settings.offers.map((item) => (item.id === offer.id ? next : item)) })}
              onRemove={() => update({ ...settings, offers: settings.offers.filter((item) => item.id !== offer.id) })}
            />
          ))}
        </div>
        <SelectField
          label="Add offer"
          value=""
          disabled={disabled}
          options={[{ value: '', label: 'Choose a type' }, ...(Object.keys(OFFER_KIND_LABELS) as OfferKind[]).map((kind) => ({ value: kind, label: OFFER_KIND_LABELS[kind] }))]}
          onChange={(kind) => {
            if (!kind) return
            update({ ...settings, offers: [...settings.offers, blankOffer(kind as OfferKind, settings.offers.length + 1)] })
          }}
        />
      </Group>
    </div>
  )
}

export function approveManifest() {
  const file = useJourney.getState().file
  if (!file.manifest || file.manifest.confirmed) return
  const settings = file.manifest.settings ?? settingsForManifest(file.manifest)
  useJourney.getState().patchFile({
    manifest: { ...file.manifest, settings, surveyReasons: reasonBinds(settings), confirmed: true },
    steps: stepsWithSettings(file.steps, settings),
  })
}
