import { useEffect, useState, type ReactNode } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { DropdownButton } from '../plays/ui'
import { uniqueName } from '../plays/names'
import {
  ACCEPT_LABEL,
  CATALOG_PLANS,
  CATEGORY_LABEL,
  PROCESSING_LABEL,
  WIDGET_LABEL,
  objectiveLabel,
  timeAgo,
  type AcceptStep,
  type GrowthObjective,
  type LibOffer,
  type LibPricingTable,
  type OfferProcessing,
  type OfferWidget,
} from './model'
import { Empty, PageShell } from './objective/ui'
import { startFromTemplate } from './objective/actions'
import { templatesFor } from './objective/templates'
import { OfferPreview, PricingPreview } from './Previews'
import { usedIn } from './useGrowthPlays'
import { useGrowthLibrary } from './useGrowthLibrary'

function PageHeader({ title, blurb, actions, onBack }: { title: string; blurb?: string; actions?: ReactNode; onBack?: () => void }) {
  return (
    <header className="flex flex-none items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
      <div className="flex min-w-0 items-start gap-[8px]">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <SIcon name="arrow-left" size={16} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold tracking-tight text-slate-900">{title}</h1>
          {blurb && <p className="mt-[2px] text-[13px] text-slate-500">{blurb}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-none items-center gap-[8px]">{actions}</div>}
    </header>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[4px]">
      <span className="text-[12px] font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-[8px] border border-slate-200 bg-white px-[10px] py-[7px] text-[13px] text-slate-900 outline-none focus:border-slate-400'

function Select<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputCls}>
      {(Object.keys(options) as T[]).map((k) => (
        <option key={k} value={k}>
          {options[k]}
        </option>
      ))}
    </select>
  )
}

/** Acquisition and Expansion share the Library, so each tab lists both, its own first. */
function forTabs<T extends { objective: string }>(items: T[], objective: GrowthObjective): T[] {
  return items.filter((i) => i.objective !== 'retention').sort((a, b) => Number(a.objective !== objective) - Number(b.objective !== objective))
}

function Status({ status }: { status: string }) {
  const style = status === 'published' ? 'bg-emerald-50 text-emerald-700' : status === 'archived' ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'
  const label = status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft'
  return <span className={`inline-flex rounded-full px-[8px] py-[2px] text-[11.5px] font-medium ${style}`}>{label}</span>
}

// ---------- Offers ----------

function OfferDetail({ offer, onBack }: { offer: LibOffer; onBack: () => void }) {
  const update = useGrowthLibrary((s) => s.updateOffer)
  const uses = usedIn(offer.id)
  const set = (patch: Partial<LibOffer>) => update(offer.id, patch)
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <PageHeader
        title={offer.name}
        blurb={`${objectiveLabel(offer.objective)} · ${CATEGORY_LABEL[offer.category]} · ${offer.redemptions.toLocaleString()} redemptions`}
        onBack={onBack}
        actions={
          <>
            <SButton
              size="small"
              variant="neutral-outline"
              disabled={uses.length > 0 || offer.status === 'archived'}
              title={uses.length ? `Used in ${uses.join(', ')}` : undefined}
              onClick={() => set({ status: 'archived' })}
            >
              Archive
            </SButton>
          </>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-[24px] overflow-y-auto px-6 py-5 min-[1100px]:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex max-w-[560px] flex-col gap-[14px]">
          <Field label="Name">
            <input className={inputCls} value={offer.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-[12px]">
            <Field label="Shown as">
              <Select<OfferWidget> value={offer.widget} options={WIDGET_LABEL} onChange={(widget) => set({ widget })} />
            </Field>
            <Field label="What they get">
              <input className={inputCls} value={offer.value} onChange={(e) => set({ value: e.target.value })} />
            </Field>
          </div>
          <Field label="Headline">
            <input className={inputCls} value={offer.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Text">
            <textarea className={`${inputCls} min-h-[70px]`} value={offer.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label="Button">
            <input className={inputCls} value={offer.cta} onChange={(e) => set({ cta: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-[12px]">
            <Field label="When they accept">
              <Select<OfferProcessing> value={offer.processing} options={PROCESSING_LABEL} onChange={(processing) => set({ processing })} />
            </Field>
            <Field label="Then">
              <Select<AcceptStep> value={offer.acceptStep} options={ACCEPT_LABEL} onChange={(acceptStep) => set({ acceptStep })} />
            </Field>
          </div>
          <Field label="Languages">
            <p className="text-[13px] text-slate-700">{offer.languages.join(', ')}</p>
          </Field>
          <Field label="Used in">
            <p className="text-[13px] text-slate-700">{uses.length ? uses.join(', ') : 'Not used yet'}</p>
          </Field>
        </div>
        <div>
          <p className="mb-[8px] text-[12px] font-medium text-slate-500">Preview</p>
          <OfferPreview offer={offer} />
        </div>
      </div>
    </div>
  )
}

export function createGrowthOffer(objective: GrowthObjective): string {
  const lib = useGrowthLibrary.getState()
  return lib.addOffer({
    name: uniqueName('New offer', lib.offers.map((x) => x.name)),
    objective,
    widget: 'modal',
    category: objective === 'expansion' ? 'annual_upgrade' : 'trial_conversion',
    title: '',
    description: '',
    cta: 'Accept',
    processing: 'billing_update',
    acceptStep: 'confirmation',
    value: '',
    languages: ['English'],
    status: 'draft',
  }).id
}

export function createPricingTable(objective: GrowthObjective): string {
  const lib = useGrowthLibrary.getState()
  return lib.addPricingTable({
    name: uniqueName('New pricing table', lib.pricingTables.map((x) => x.name)),
    objective,
    plans: CATALOG_PLANS.filter((p) => p.period === 'month'),
    frequency: 'monthly',
    hideCurrentPlan: objective === 'expansion',
    cta: 'checkout',
    status: 'draft',
  }).id
}

/** Opens `focusId` whenever it changes, so a caller outside the page can jump to one item. */
function useFocusedId(focusId: string | null | undefined) {
  const [openId, setOpenId] = useState<string | null>(focusId ?? null)
  useEffect(() => {
    if (focusId) setOpenId(focusId)
  }, [focusId])
  return [openId, setOpenId] as const
}

export function OffersPage({ objective, embedded = false, focusId }: { objective: GrowthObjective; embedded?: boolean; focusId?: string | null }) {
  const offers = useGrowthLibrary((s) => s.offers)
  const [openId, setOpenId] = useFocusedId(focusId)
  const open = offers.find((o) => o.id === openId)
  if (open) return <OfferDetail offer={open} onBack={() => setOpenId(null)} />

  const rows = forTabs(offers.filter((o) => o.status !== 'archived'), objective)
  const create = () => setOpenId(createGrowthOffer(objective))
  return (
    <PageShell
      objective={objective}
      title="Offers"
      blurb="The value you give and how it is fulfilled. Acquisition and Expansion share these, so one offer can sit in experiences in both."
      wide
      embedded={embedded}
      actions={
        <DropdownButton
          label="New"
          items={[
            { label: 'Blank offer', icon: 'plus', onClick: create },
            ...templatesFor(objective, 'in_app_offer').map((t) => ({
              label: t.name,
              icon: 'layout-template' as const,
              hint: 'From a template, as a new experience',
              onClick: () => startFromTemplate(objective, t, null),
            })),
          ]}
        />
      }
    >
      {rows.length === 0 ? (
        <Empty>No offers yet.</Empty>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[12px] font-medium text-slate-400">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Made for</th>
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 font-medium">Shown as</th>
              <th className="pb-2 font-medium">Used in</th>
              <th className="pb-2 font-medium">Redemptions</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const uses = usedIn(o.id)
              return (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="py-3">
                    <button type="button" className="font-medium text-slate-900 hover:underline" onClick={() => setOpenId(o.id)}>
                      {o.name}
                    </button>
                  </td>
                  <td className="py-3 text-slate-600">{objectiveLabel(o.objective)}</td>
                  <td className="py-3 text-slate-600">{CATEGORY_LABEL[o.category]}</td>
                  <td className="py-3 text-slate-600">{WIDGET_LABEL[o.widget]}</td>
                  <td className="py-3 text-slate-600" title={uses.join(', ') || undefined}>{uses.length ? uses.length : '—'}</td>
                  <td className="py-3 text-slate-600">{o.redemptions.toLocaleString()}</td>
                  <td className="py-3">
                    <Status status={o.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </PageShell>
  )
}

// ---------- Pricing tables ----------

function TableDetail({ table, onBack }: { table: LibPricingTable; onBack: () => void }) {
  const update = useGrowthLibrary((s) => s.updatePricingTable)
  const set = (patch: Partial<LibPricingTable>) => update(table.id, patch)
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (what: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => setCopied(what))
  }
  const togglePlan = (id: string) => {
    const has = table.plans.some((p) => p.id === id)
    const plans = has ? table.plans.filter((p) => p.id !== id) : [...table.plans, CATALOG_PLANS.find((p) => p.id === id)!]
    if (plans.length) set({ plans })
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <PageHeader
        title={table.name}
        blurb={`${objectiveLabel(table.objective)} · Used in ${usedIn(table.id).join(', ') || 'nothing yet'}`}
        onBack={onBack}
        actions={
          <>
            <SButton size="small" variant="neutral-outline" onClick={() => copy('link', `https://pricing.example.com/t/${table.id}`)}>
              {copied === 'link' ? 'Link copied' : 'Copy share link'}
            </SButton>
            <SButton
              size="small"
              variant="neutral-outline"
              onClick={() => copy('embed', `<div data-cb-pricing-table="${table.id}"></div>\n<script src="https://js.chargebee.com/v2/chargebee.js"></script>`)}
            >
              {copied === 'embed' ? 'Embed code copied' : 'Copy embed code'}
            </SButton>
          </>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-[24px] overflow-y-auto px-6 py-5 min-[1100px]:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-[14px]">
          <Field label="Name">
            <input className={inputCls} value={table.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Plans from your catalog">
            <div className="flex flex-col rounded-[10px] border border-slate-200">
              {CATALOG_PLANS.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-[10px] border-t border-slate-100 px-[10px] py-[7px] text-[13px] first:border-t-0">
                  <input type="checkbox" checked={table.plans.some((x) => x.id === p.id)} onChange={() => togglePlan(p.id)} />
                  <span className="flex-1 text-slate-800">{p.name}</span>
                  <span className="text-slate-500">
                    ${p.price}/{p.period}
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-[12px]">
            <Field label="Billing periods">
              <Select value={table.frequency} options={{ monthly: 'Monthly', yearly: 'Yearly', both: 'Both, with a toggle' }} onChange={(frequency) => set({ frequency })} />
            </Field>
            <Field label="Buttons">
              <Select value={table.cta} options={{ checkout: 'Go to checkout', contact: 'Contact us' }} onChange={(cta) => set({ cta })} />
            </Field>
          </div>
          <label className="flex items-center gap-[8px] text-[13px] text-slate-700">
            <input type="checkbox" checked={table.hideCurrentPlan} onChange={(e) => set({ hideCurrentPlan: e.target.checked })} />
            Hide the plan they are already on
          </label>
          <Field label="Accent colour (overrides your brand here)">
            <div className="flex items-center gap-[8px]">
              <input type="color" value={table.accent ?? '#4f46e5'} onChange={(e) => set({ accent: e.target.value })} className="h-8 w-10 rounded border border-slate-200" />
              {table.accent && (
                <button type="button" className="text-[12.5px] text-slate-500 hover:text-slate-800" onClick={() => set({ accent: undefined })}>
                  Use brand colour
                </button>
              )}
            </div>
          </Field>
        </div>
        <div>
          <p className="mb-[8px] text-[12px] font-medium text-slate-500">Preview</p>
          <PricingPreview table={table} />
        </div>
      </div>
    </div>
  )
}

export function PricingTablesPage({ objective, embedded = false, focusId }: { objective: GrowthObjective; embedded?: boolean; focusId?: string | null }) {
  const tables = useGrowthLibrary((s) => s.pricingTables)
  const [openId, setOpenId] = useFocusedId(focusId)
  const open = tables.find((t) => t.id === openId)
  if (open) return <TableDetail table={open} onBack={() => setOpenId(null)} />
  const rows = forTabs(tables.filter((t) => t.status !== 'archived'), objective)
  const create = () => setOpenId(createPricingTable(objective))
  return (
    <PageShell
      objective={objective}
      title="Pricing tables"
      blurb="Plans from your catalog, shared by Acquisition and Expansion. Show one in an experience, share it as a link or embed it."
      wide
      embedded={embedded}
      actions={
        <DropdownButton
          label="New"
          items={[
            { label: 'Blank pricing table', icon: 'plus', onClick: create },
            ...templatesFor(objective, 'pricing_table').map((t) => ({
              label: t.name,
              icon: 'layout-template' as const,
              hint: 'From a template, as a new experience',
              onClick: () => startFromTemplate(objective, t, null),
            })),
          ]}
        />
      }
    >
      {rows.length === 0 ? (
        <Empty>No pricing tables yet.</Empty>
      ) : (
        <div className="grid gap-[14px] min-[1000px]:grid-cols-2">
          {rows.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenId(t.id)}
              className="rounded-xl border border-slate-200 bg-white p-[14px] text-left transition-shadow hover:border-slate-300 hover:shadow-sm"
            >
              <div className="mb-[10px] flex items-center justify-between gap-[10px]">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{t.name}</p>
                  <p className="text-[12px] text-slate-500">
                    Made for {objectiveLabel(t.objective)} · {t.plans.length} plans · {timeAgo(t.updatedAt)}
                  </p>
                </div>
                <Status status={t.status} />
              </div>
              <PricingPreview table={t} />
            </button>
          ))}
        </div>
      )}
    </PageShell>
  )
}
