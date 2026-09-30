import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { AgentChat } from '../agent/AgentChat'
import { doorsFor } from '../agent/cards'
import { chatFor, sendAs } from '../agent/chats'
import { AUDIENCES } from '../agent/context'
import { useAgentStore } from '../agent/useAgentStore'
import { EASE_ENTER, PANEL_MS } from '../lib/motion'
import { SIDEBAR_FOLDED_W, SIDEBAR_W } from '../layout/ThreadSidebar'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { useOwnerChat } from './CancelWorkspace'
import { ChatsPane } from './ChatsPane'
import { StatusPill } from './ExperienceList'
import { TRIGGER_LABEL, TYPE_LABEL, WIDGET_LABEL, objectiveLabel, type GrowthExperience, type TriggerKind } from './model'
import { OfferPreview, PricingPreview } from './Previews'
import { useGrowthExperiences } from './useGrowthExperiences'
import { useGrowthLibrary } from './useGrowthLibrary'

const inputCls =
  'w-full rounded-[8px] border border-slate-200 bg-white px-[10px] py-[7px] text-[13px] text-slate-900 outline-none focus:border-slate-400'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-[14px] border-t border-slate-100 py-[12px] first:border-t-0">
      <div>
        <p className="text-[13px] font-medium text-slate-800">{label}</p>
        {hint && <p className="text-[12px] leading-[1.45] text-slate-500">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function refOptions(x: GrowthExperience) {
  const lib = useGrowthLibrary.getState()
  return x.type === 'pricing_table'
    ? lib.pricingTables.filter((t) => t.status !== 'archived').map((t) => ({ id: t.id, name: t.name }))
    : lib.offers.filter((o) => o.status !== 'archived').map((o) => ({ id: o.id, name: `${o.name} · ${WIDGET_LABEL[o.widget]}` }))
}

function Setup({ x }: { x: GrowthExperience }) {
  const update = useGrowthExperiences((s) => s.update)
  const moveTo = useGrowthExperiences((s) => s.moveTo)
  const peers = useGrowthExperiences((s) => s.items.filter((i) => i.objective === x.objective && i.type === x.type && i.status !== 'archived').length)
  useGrowthLibrary((s) => s.offers)
  const set = (patch: Partial<GrowthExperience>) => update(x.id, patch)
  const options = refOptions(x)
  const testing = x.variants.length > 1

  return (
    <div className="mx-auto max-w-[720px] px-[28px] py-[20px]">
      <Row label="Name">
        <input className={inputCls} value={x.name} onChange={(e) => set({ name: e.target.value })} />
      </Row>
      <Row label={x.type === 'pricing_table' ? 'Pricing table' : 'Offer'} hint="From your Library">
        {testing ? (
          <p className="text-[13px] text-slate-600">Set by the test below.</p>
        ) : (
          <select
            className={inputCls}
            value={x.variants[0]?.refId ?? ''}
            onChange={(e) => set({ variants: e.target.value ? [{ id: 'v1', refId: e.target.value, percent: 100 }] : [] })}
          >
            <option value="">Pick one</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </Row>
      <Row label="Audience" hint="Who can see it">
        <select className={inputCls} value={x.audienceId} onChange={(e) => set({ audienceId: e.target.value })}>
          {AUDIENCES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Trigger" hint="When it shows">
        <div className="flex gap-[8px]">
          <select
            className={inputCls}
            value={x.trigger.kind}
            onChange={(e) => set({ trigger: { kind: e.target.value as TriggerKind, value: x.trigger.value } })}
          >
            {(Object.keys(TRIGGER_LABEL) as TriggerKind[]).map((k) => (
              <option key={k} value={k}>
                {TRIGGER_LABEL[k]}
              </option>
            ))}
          </select>
          {x.trigger.kind !== 'any_page' && (
            <input
              className={inputCls}
              placeholder={x.trigger.kind === 'url' ? '/billing' : 'event_name'}
              value={x.trigger.value ?? ''}
              onChange={(e) => set({ trigger: { ...x.trigger, value: e.target.value } })}
            />
          )}
        </div>
      </Row>
      <Row label="Test" hint="Split the audience across versions">
        {testing ? (
          <ul className="flex flex-col gap-[4px]">
            {x.variants.map((v, i) => (
              <li key={v.id} className="flex justify-between rounded-[8px] bg-slate-50 px-[10px] py-[6px] text-[13px]">
                <span className="text-slate-800">
                  Version {String.fromCharCode(65 + i)} · {options.find((o) => o.id === v.refId)?.name ?? v.refId}
                </span>
                <span className="font-medium text-slate-900">{v.percent}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-slate-500">No test. Ask Copilot to set one up.</p>
        )}
      </Row>
      <Row label="Control group" hint="See nothing, so you can measure lift">
        <div className="flex items-center gap-[8px]">
          <input
            type="number"
            min={0}
            max={50}
            className={`${inputCls} w-[90px]`}
            value={x.control}
            onChange={(e) => set({ control: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
          />
          <span className="text-[13px] text-slate-500">% of the audience</span>
        </div>
      </Row>
      <Row label="Priority" hint={`Among ${peers} ${TYPE_LABEL[x.type].toLowerCase()}s in ${objectiveLabel(x.objective)}`}>
        <select className={`${inputCls} w-[90px]`} value={x.priority} onChange={(e) => moveTo(x.id, Number(e.target.value))}>
          {Array.from({ length: Math.max(peers, x.priority) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Row>
    </div>
  )
}

function Preview({ x }: { x: GrowthExperience }) {
  const offers = useGrowthLibrary((s) => s.offers)
  const tables = useGrowthLibrary((s) => s.pricingTables)
  const ref = x.variants[0]?.refId
  const offer = offers.find((o) => o.id === ref)
  const table = tables.find((t) => t.id === ref)
  return (
    <div className="mx-auto max-w-[760px] px-[28px] py-[20px]">
      {offer ? (
        <OfferPreview offer={offer} />
      ) : table ? (
        <PricingPreview table={table} />
      ) : (
        <p className="py-[60px] text-center text-[13px] text-slate-500">Pick {x.type === 'pricing_table' ? 'a pricing table' : 'an offer'} to see it here.</p>
      )}
    </div>
  )
}

function WorkPane({ x }: { x: GrowthExperience }) {
  const [tab, setTab] = useState<'setup' | 'preview'>('setup')
  const update = useGrowthExperiences((s) => s.update)
  const live = x.status === 'live'
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div className="flex h-[60px] flex-none items-center justify-between gap-[12px] border-b border-slate-100 px-[20px]">
        <div className="flex min-w-0 items-center gap-[4px]">
          {(['setup', 'preview'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-[8px] px-[12px] py-[6px] text-[13px] font-medium ${
                tab === id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {id === 'setup' ? 'Setup' : 'Preview'}
            </button>
          ))}
        </div>
        <div className="flex flex-none items-center gap-[10px]">
          <StatusPill status={x.status} />
          <SButton
            size="small"
            variant={live ? 'neutral-outline' : 'primary'}
            disabled={!live && x.variants.length === 0}
            onClick={() => update(x.id, { status: live ? 'inactive' : 'live' })}
          >
            {live ? 'Pause' : 'Publish'}
          </SButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{tab === 'setup' ? <Setup x={x} /> : <Preview x={x} />}</div>
    </div>
  )
}

function Doors({ x, chatId }: { x: GrowthExperience; chatId: string }) {
  const [picking, setPicking] = useState(false)
  const offers = useGrowthLibrary((s) => s.offers)
  const tables = useGrowthLibrary((s) => s.pricingTables)
  const update = useGrowthExperiences((s) => s.update)
  const rows =
    x.type === 'pricing_table'
      ? tables.filter((t) => t.status !== 'archived').map((t) => ({ id: t.id, name: t.name, meta: t.plans.map((p) => p.name).join(' · '), fits: t.objective === x.objective }))
      : offers.filter((o) => o.status !== 'archived').map((o) => ({ id: o.id, name: o.name, meta: `${WIDGET_LABEL[o.widget]} · ${o.value}`, fits: o.objective === x.objective }))

  if (picking) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-[24px] py-[40px]">
        <button type="button" onClick={() => setPicking(false)} className="mb-[12px] inline-flex items-center gap-[6px] text-[13px] text-slate-500 hover:text-slate-900">
          <SIcon name="arrow-left" size={14} />
          Back
        </button>
        <h1 className="text-[20px] font-semibold text-slate-900">{x.type === 'pricing_table' ? 'Pick a pricing table' : 'Pick an offer'}</h1>
        <div className="mt-[14px] flex flex-col rounded-[14px] border border-slate-200 bg-white">
          {[...rows]
            .sort((a, b) => Number(b.fits) - Number(a.fits))
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => update(x.id, { variants: [{ id: 'v1', refId: r.id, percent: 100 }] })}
                className="flex items-center justify-between gap-[12px] border-t border-slate-100 px-[16px] py-[12px] text-left first:border-t-0 hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-slate-900">{r.name}</span>
                  <span className="block truncate text-[12.5px] text-slate-500">{r.meta}</span>
                </span>
                {r.fits && <span className="flex-none rounded-full bg-slate-100 px-[8px] py-[2px] text-[11px] text-slate-600">{objectiveLabel(x.objective)}</span>}
              </button>
            ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-slate-100 px-[24px] py-[40px]">
      <div className="flex max-w-[640px] flex-col items-center gap-[32px]">
        <div className="text-center">
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Start {x.type === 'pricing_table' ? 'a pricing table' : 'an in-app offer'}</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            {objectiveLabel(x.objective)}. Pick one you already have, or tell Copilot what you need.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {doorsFor(x.type).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => (d.id === 'library' ? setPicking(true) : sendAs(chatId, `Help me set up this ${TYPE_LABEL[x.type].toLowerCase()}.`))}
              className="w-[268px] rounded-[16px] border border-slate-200 bg-white p-[18px] text-left transition-transform duration-200 hover:-translate-y-[6px]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#4f46e5]">
                <SIcon name={d.icon} size={18} />
              </span>
              <p className="mt-[12px] text-[14px] font-semibold text-slate-900">{d.title}</p>
              <p className="mt-[4px] text-[12.5px] leading-[1.5] text-slate-500">{d.body}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function GrowthWorkspace() {
  const x = useGrowthExperiences((s) => s.items.find((i) => i.id === s.activeId))
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const owner = x ? (`growth:${x.id}` as const) : null
  const chatId = useOwnerChat(owner)
  const started = useStarted(chatId)

  if (!x || !owner) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[8px] bg-white text-center">
        <p className="text-[14px] font-medium text-slate-700">This experience is not here any more.</p>
        <SButton size="small" variant="neutral-outline" onClick={() => useGrowthShell.getState().go('home')}>
          Go to Home
        </SButton>
      </div>
    )
  }

  const blank = x.variants.length === 0 && !started
  const back = () => useGrowthShell.getState().go(`experiences.${x.objective}`)

  return (
    <div
      className="grid h-full min-h-0 bg-white motion-reduce:transition-none"
      style={{
        gridTemplateColumns: `${sidebarOpen ? SIDEBAR_W : SIDEBAR_FOLDED_W}px minmax(0,1fr)`,
        transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
      }}
    >
      <ChatsPane
        owner={owner}
        title={x.name}
        meta={`${objectiveLabel(x.objective)} · ${TYPE_LABEL[x.type]}`}
        backLabel={`Back to ${objectiveLabel(x.objective)}`}
        onBack={back}
      />
      <div className="flex min-h-0 min-w-0">
        {!chatId ? null : blank ? (
          <div className="min-w-0 flex-1">
            <Doors x={x} chatId={chatId} />
          </div>
        ) : (
          <>
            <div className="flex w-[clamp(360px,32%,500px)] flex-none flex-col border-r border-slate-200 bg-white">
              <AgentChat key={chatId} chatId={chatId} />
            </div>
            <WorkPane x={x} />
          </>
        )}
      </div>
    </div>
  )
}

/** True once the chat has any message, including one still streaming. */
function useStarted(chatId: string | null): boolean {
  const saved = useAgentStore((s) => (chatId ? (s.chats[chatId]?.messages.length ?? 0) > 0 : false))
  const live = useSyncExternalStore(
    (cb) => (chatId ? chatFor(chatId)['~registerMessagesCallback'](cb) : () => {}),
    () => (chatId ? chatFor(chatId).messages.length > 0 : false),
  )
  return saved || live
}
