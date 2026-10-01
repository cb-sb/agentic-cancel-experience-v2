import { useEffect, useState, type ReactNode } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import type { AfterAccept, OfferFulfilment, OfferKey } from '../journey/types'
import { OFFER_VARIANTS, offerVariantLabel, offerVariantPatch } from '../lib/offerVariants'
import { useWorkspaceUi, type LibraryKind } from '../workspace/useWorkspaceUi'
import {
  OFFER_ACTIONS,
  nameTakenIn,
  newCard,
  newConfirmation,
  newOffer,
  newReason,
  newRedirect,
  patchItem,
  removeItem,
  useCancelLibrary,
  type LibCard,
  type LibConfirmation,
  type LibOffer,
  type LibReason,
  type LibRedirect,
  type ReasonKind,
} from './useCancelLibrary'

const KINDS: { id: LibraryKind; label: string; hint: string; add: string }[] = [
  { id: 'offers', label: 'Offers', hint: 'What you offer instead of letting them go, and how it’s applied', add: 'New offer' },
  { id: 'reasons', label: 'Survey reasons', hint: 'The reasons people pick, plus competitor and come-back questions', add: 'New reason' },
  { id: 'cards', label: 'Loss aversion cards', hint: 'What they keep and what they lose if they cancel', add: 'New card' },
  { id: 'confirmations', label: 'Confirmation pages', hint: 'The last page after they stay, or after the cancel is done', add: 'New confirmation page' },
  { id: 'redirects', label: 'Redirect pages', hint: 'Pages on your site you can send people to instead of cancelling', add: 'New redirect page' },
]

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none placeholder:text-slate-300 hover:border-slate-300 focus:border-slate-400'

function Text({ label, value, onChange, placeholder, area, error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; area?: boolean; error?: string | null }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => v !== value && onChange(v)
  return (
    <label className="block">
      <span className="text-[11.5px] font-medium text-slate-500">{label}</span>
      {area ? (
        <textarea value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={2} className={`mt-1 resize-none ${inputCls}`} />
      ) : (
        <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={`mt-1 ${inputCls}`} />
      )}
      {error && <span className="mt-[3px] block text-[12px] text-rose-600">{error}</span>}
    </label>
  )
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-medium text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={`mt-1 ${inputCls}`}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Lines({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  return (
    <div>
      <span className="text-[11.5px] font-medium text-slate-500">{label}</span>
      <div className="mt-1 space-y-[4px]">
        {items.map((x, i) => (
          <div key={i} className="flex items-center gap-[4px]">
            <input
              defaultValue={x}
              placeholder={placeholder}
              onBlur={(e) => e.target.value !== x && onChange(items.map((y, j) => (j === i ? e.target.value : y)))}
              className={inputCls}
            />
            <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <SIcon name="x" size={12} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, ''])} className="inline-flex items-center gap-[4px] rounded-lg px-[6px] py-[4px] text-[12px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <SIcon name="plus" size={11} /> Add
        </button>
      </div>
    </div>
  )
}

const FULFILMENT: { id: OfferFulfilment; label: string }[] = [
  { id: 'billing', label: 'Billing applies it' },
  { id: 'url', label: 'Send them to a page' },
  { id: 'webhook', label: 'Call a webhook' },
  { id: 'email', label: 'Email your team' },
]

const AFTER: { id: AfterAccept; label: string }[] = [
  { id: 'confirmation', label: 'Show a thank-you' },
  { id: 'feedback', label: 'Ask one quick question' },
  { id: 'dismiss', label: 'Just close' },
]

function nameError(list: 'offers' | 'cards' | 'confirmations' | 'reasons' | 'redirects', itemId: string, name: string, what: string): string | null {
  if (!name.trim()) return 'Give it a name'
  return nameTakenIn(list, itemId, name) ? `Another ${what} is already called this` : null
}

function OfferForm({ o }: { o: LibOffer }) {
  const [err, setErr] = useState<string | null>(null)
  const p = (change: Partial<LibOffer>) => patchItem('offers', o.id, change)
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      <Text
        label="Name"
        value={o.name}
        error={err}
        onChange={(name) => {
          const e = nameError('offers', o.id, name, 'offer')
          setErr(e)
          if (!e) p({ name: name.trim() })
        }}
      />
      <Select
        label="Type"
        value={o.type}
        options={OFFER_VARIANTS.map((v) => ({ id: v.category as OfferKey, label: v.label }))}
        onChange={(type) => {
          const v = offerVariantPatch(type)
          p({ type, title: v.title ?? o.title, description: v.description ?? o.description, cta: v.primaryCta ?? o.cta })
        }}
      />
      <div className="col-span-2">
        <Text label="Headline" value={o.title} onChange={(title) => p({ title })} />
      </div>
      <div className="col-span-2">
        <Text label="Description" value={o.description} onChange={(description) => p({ description })} area />
      </div>
      <Text label="Button" value={o.cta} onChange={(cta) => p({ cta })} />
      <Select label="After they accept" value={o.afterAccept} options={AFTER} onChange={(afterAccept) => p({ afterAccept })} />
      <Select label="Fulfilment" value={o.fulfilment} options={FULFILMENT} onChange={(fulfilment) => p({ fulfilment })} />
      {o.fulfilment !== 'billing' ? (
        <Text label={o.fulfilment === 'email' ? 'Email address' : 'URL'} value={o.fulfilmentTarget} onChange={(fulfilmentTarget) => p({ fulfilmentTarget })} placeholder={o.fulfilment === 'email' ? 'retention@yoursite.com' : 'https://'} />
      ) : (
        <div />
      )}
      <div className="col-span-2">
        <span className="text-[11.5px] font-medium text-slate-500">What happens in billing</span>
        <div className="mt-1 grid grid-cols-2 gap-[4px]">
          {OFFER_ACTIONS.map((a) => (
            <label key={a.id} className="flex items-center gap-[8px] rounded-lg px-[6px] py-[4px] text-[12.5px] text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={o.actions.includes(a.id)}
                onChange={(e) => p({ actions: e.target.checked ? [...o.actions, a.id] : o.actions.filter((x) => x !== a.id) })}
                className="accent-slate-800"
              />
              {a.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

const REASON_KIND: { id: ReasonKind; label: string }[] = [
  { id: 'standard', label: 'Reason' },
  { id: 'competitor', label: 'Competitor pulse' },
  { id: 'return', label: 'Return likelihood' },
]

function ReasonForm({ r }: { r: LibReason }) {
  const [err, setErr] = useState<string | null>(null)
  const p = (change: Partial<LibReason>) => patchItem('reasons', r.id, change)
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      <Text
        label={r.kind === 'standard' ? 'Reason' : 'Question'}
        value={r.label}
        error={err}
        onChange={(label) => {
          const e = nameError('reasons', r.id, label, 'reason')
          setErr(e)
          if (!e) p({ label: label.trim() })
        }}
      />
      <Select label="Kind" value={r.kind} options={REASON_KIND} onChange={(kind) => p({ kind })} />
      {r.kind === 'standard' && (
        <div className="col-span-2">
          <Text label="Follow-up question (optional)" value={r.followUp} onChange={(followUp) => p({ followUp })} placeholder="What could we have done better?" />
        </div>
      )}
      {r.kind === 'competitor' && (
        <div className="col-span-2">
          <Lines label="Products people can pick" items={r.options} onChange={(options) => p({ options })} placeholder="A product name" />
        </div>
      )}
      {r.kind === 'return' && <p className="col-span-2 text-[12px] text-slate-500">Shown as a 1 to 5 scale, from “Not likely” to “Very likely”.</p>}
    </div>
  )
}

function CardForm({ c }: { c: LibCard }) {
  const [err, setErr] = useState<string | null>(null)
  const p = (change: Partial<LibCard>) => patchItem('cards', c.id, change)
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      <Text
        label="Name"
        value={c.name}
        error={err}
        onChange={(name) => {
          const e = nameError('cards', c.id, name, 'card')
          setErr(e)
          if (!e) p({ name: name.trim() })
        }}
      />
      <Text label="Headline" value={c.title} onChange={(title) => p({ title })} />
      <Lines label="They keep" items={c.keep} onChange={(keep) => p({ keep })} placeholder="Something they keep" />
      <Lines label="They lose" items={c.lose} onChange={(lose) => p({ lose })} placeholder="Something they lose" />
    </div>
  )
}

function ConfirmationForm({ c }: { c: LibConfirmation }) {
  const [err, setErr] = useState<string | null>(null)
  const p = (change: Partial<LibConfirmation>) => patchItem('confirmations', c.id, change)
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      <Text
        label="Name"
        value={c.name}
        error={err}
        onChange={(name) => {
          const e = nameError('confirmations', c.id, name, 'confirmation page')
          setErr(e)
          if (!e) p({ name: name.trim() })
        }}
      />
      <Select label="Shown when" value={c.kind} options={[{ id: 'saved', label: 'They stay' }, { id: 'cancelled', label: 'The cancel is done' }]} onChange={(kind) => p({ kind })} />
      <div className="col-span-2">
        <Text label="Headline" value={c.title} onChange={(title) => p({ title })} />
      </div>
      <div className="col-span-2">
        <Text label="Message" value={c.body} onChange={(body) => p({ body })} area />
      </div>
      <Text label="Button" value={c.cta} onChange={(cta) => p({ cta })} />
      <Text label="Button goes to (optional)" value={c.url} onChange={(url) => p({ url })} placeholder="https://" />
    </div>
  )
}

function RedirectForm({ r }: { r: LibRedirect }) {
  const [err, setErr] = useState<string | null>(null)
  const p = (change: Partial<LibRedirect>) => patchItem('redirects', r.id, change)
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      <Text
        label="Name"
        value={r.name}
        error={err}
        onChange={(name) => {
          const e = nameError('redirects', r.id, name, 'redirect page')
          setErr(e)
          if (!e) p({ name: name.trim() })
        }}
      />
      <Text label="URL" value={r.url} onChange={(url) => p({ url: url.trim() })} placeholder="https://" />
    </div>
  )
}

function ItemRow({ id, title, detail, open, onToggle, onDelete, children }: { id: string; title: string; detail: string; open: boolean; onToggle: () => void; onDelete: () => void; children: ReactNode }) {
  const [asking, setAsking] = useState(false)
  return (
    <li data-lib-item={id} className="border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-[10px] px-[14px] py-[10px]">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-[10px] text-left">
          <SIcon name={open ? 'chevron-down' : 'chevron-right'} size={13} className="flex-none text-slate-400" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-slate-900">{title}</span>
            <span className="block truncate text-[12px] text-slate-500">{detail}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => (asking ? onDelete() : setAsking(true))}
          onBlur={() => setAsking(false)}
          className={`flex-none rounded-lg px-[8px] py-[4px] text-[12px] font-semibold ${asking ? 'bg-rose-50 text-rose-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
        >
          {asking ? 'Click again to delete' : <SIcon name="trash-2" size={13} />}
        </button>
      </div>
      {open && <div className="px-[14px] pb-[14px] pl-[37px]">{children}</div>}
    </li>
  )
}

/** The Create menu's last request for a new item, so each one opens exactly one form. */
let consumedBump = 0

/** Cancel components the merchant reuses across experiences. */
export function LibraryPage() {
  const kind = useWorkspaceUi((s) => s.libraryKind)
  const bump = useWorkspaceUi((s) => s.libraryNew)
  const focus = useWorkspaceUi((s) => s.libraryFocus)
  const lib = useCancelLibrary()
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!focus) return
    setOpen(focus)
    useWorkspaceUi.setState({ libraryFocus: null })
    window.requestAnimationFrame(() => document.querySelector(`[data-lib-item="${focus}"]`)?.scrollIntoView({ block: 'center' }))
  }, [focus])
  const meta = KINDS.find((k) => k.id === kind) ?? KINDS[0]

  const create = () => {
    const id =
      kind === 'reasons'
        ? newReason()
        : kind === 'cards'
          ? newCard()
          : kind === 'confirmations'
            ? newConfirmation()
            : kind === 'redirects'
              ? newRedirect()
              : newOffer()
    setOpen(id)
  }

  useEffect(() => {
    if (bump <= consumedBump) return
    consumedBump = bump
    create()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump])

  const toggle = (id: string) => setOpen((o) => (o === id ? null : id))
  let rows: ReactNode
  if (kind === 'reasons') {
    rows = lib.reasons.map((r) => (
      <ItemRow key={r.id} id={r.id} title={r.label} detail={REASON_KIND.find((k) => k.id === r.kind)?.label ?? ''} open={open === r.id} onToggle={() => toggle(r.id)} onDelete={() => removeItem('reasons', r.id)}>
        <ReasonForm r={r} />
      </ItemRow>
    ))
  } else if (kind === 'cards') {
    rows = lib.cards.map((c) => (
      <ItemRow key={c.id} id={c.id} title={c.name} detail={`${c.keep.filter(Boolean).length} kept, ${c.lose.filter(Boolean).length} lost`} open={open === c.id} onToggle={() => toggle(c.id)} onDelete={() => removeItem('cards', c.id)}>
        <CardForm c={c} />
      </ItemRow>
    ))
  } else if (kind === 'confirmations') {
    rows = lib.confirmations.map((c) => (
      <ItemRow key={c.id} id={c.id} title={c.name} detail={c.kind === 'saved' ? 'When they stay' : 'When the cancel is done'} open={open === c.id} onToggle={() => toggle(c.id)} onDelete={() => removeItem('confirmations', c.id)}>
        <ConfirmationForm c={c} />
      </ItemRow>
    ))
  } else if (kind === 'redirects') {
    rows = lib.redirects.map((r) => (
      <ItemRow key={r.id} id={r.id} title={r.name} detail={r.url || 'No URL yet'} open={open === r.id} onToggle={() => toggle(r.id)} onDelete={() => removeItem('redirects', r.id)}>
        <RedirectForm r={r} />
      </ItemRow>
    ))
  } else {
    rows = lib.offers.map((o) => (
      <ItemRow key={o.id} id={o.id} title={o.name} detail={`${offerVariantLabel(o.type)} · ${FULFILMENT.find((f) => f.id === o.fulfilment)?.label}`} open={open === o.id} onToggle={() => toggle(o.id)} onDelete={() => removeItem('offers', o.id)}>
        <OfferForm o={o} />
      </ItemRow>
    ))
  }
  const count = kind === 'offers' ? lib.offers.length : lib[kind].length

  return (
    <div className="flex h-full min-w-0 flex-1 bg-slate-50">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] space-y-[14px] px-[28px] py-[24px]">
          <div className="flex items-start gap-[12px]">
            <div className="min-w-0 flex-1">
              <h1 className="text-[20px] font-semibold text-slate-900">{meta.label}</h1>
              <p className="mt-[4px] text-[13px] text-slate-500">{meta.hint}</p>
            </div>
            <SButton size="small" variant="primary" className="w-auto flex-none" onClick={create}>
              <span className="inline-flex items-center gap-[5px]">
                <SIcon name="plus" size={13} /> {meta.add}
              </span>
            </SButton>
          </div>
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {rows}
            {count === 0 && <li className="px-[14px] py-[12px] text-[13px] text-slate-500">Nothing here yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
