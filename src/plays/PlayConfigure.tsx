import { useMemo, useRef, useState, type ReactNode } from 'react'
import { SButton, SIcon, type SIconName } from '@chargebee/sting-react'
import { RuleBuilder } from '../orchestration/NodeSetup'
import { rulesOf } from '../play/resolve'
import { failing, playChecks } from '../setup/checks'
import { useSetupInputs } from '../setup/progress'
import { AUDIENCE_LIBRARY, RULE_OPERATOR_LABELS, type Audience } from '../types/orchestration'
import { openTab } from '../workspace/paneTabs'
import { orderedThreads, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi, type ConfigureStep } from '../workspace/useWorkspaceUi'
import { createExperience, openExperience } from './navigate'
import { audienceText, fallbackVariant, pagesIn, splitProblem } from './resolve'
import { ALL_AUDIENCE, type CancelPlay, type EmptyRow, type PlayVariant } from './types'
import {
  addRow,
  addSubAudience,
  audienceUnset,
  evenWeightsIn,
  groupOf,
  removeRow,
  removeSubAudience,
  savedAudience,
  setAction,
  setPlayLive,
  setRowPage,
  setRowWeight,
  setSubAudience,
  updatePlay,
} from './usePlays'
import { RowMenu, toast, useOutside } from './ui'

const STEPS: { step: ConfigureStep; label: string }[] = [
  { step: 1, label: 'Audience' },
  { step: 2, label: 'Targeting & Experimentation' },
  { step: 3, label: 'Review & Publish' },
]

let n = 0
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${n++}`

function customAudience(name: string, from?: Audience): Audience {
  const rules = from ? rulesOf(from) : { conditions: [], match: 'AND' as const }
  return {
    id: localId('aud'),
    name,
    ruleType: 'TARGETING',
    match: rules.match,
    conditions: rules.conditions.map((c) => ({ ...c, id: localId('cond') })),
    savedAudienceId: null,
  }
}

function audienceName(a: Audience, fallback: string): string {
  return audienceUnset(a) ? fallback : audienceText(a)
}

function audienceDone(play: CancelPlay): boolean {
  return Boolean(play.audience.targetAll) || !audienceUnset(play.audience)
}

function targetingDone(play: CancelPlay): boolean {
  return play.variants.length > 0 && splitProblem(play) === null
}

/* ── Small parts ─────────────────────────────────────────────── */

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-[16px] ${className}`}>{children}</div>
}

function CardTitle({ icon, children, action }: { icon: SIconName; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-[10px] flex items-center gap-[8px]">
      <SIcon name={icon} size={15} className="flex-none text-slate-600" />
      <h3 className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-900">{children}</h3>
      {action}
    </div>
  )
}

function IconButton({ icon, label, onClick, disabled }: { icon: SIconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <SIcon name={icon} size={14} />
    </button>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-[8px] text-[12.5px] text-slate-700">
      <span aria-hidden>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative h-[18px] w-[32px] flex-none rounded-full transition-colors ${on ? 'bg-[#1a56db]' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? 'left-[16px]' : 'left-[2px]'}`} />
      </button>
    </div>
  )
}

/** The rules of an audience as WHEN / AND lines. */
function RulesList({ audience }: { audience: Audience }) {
  const { conditions, match } = rulesOf(audience)
  const live = conditions.filter((c) => c.property)
  if (audience.targetAll) return <p className="text-[12.5px] text-slate-500">Everyone who clicks Cancel.</p>
  if (live.length === 0) return <p className="text-[12.5px] text-slate-400">No rules yet.</p>
  return (
    <div className="space-y-[6px]">
      {live.map((c, i) => (
        <div key={c.id} className="flex items-center gap-[10px] text-[12.5px]">
          <span className="w-[40px] flex-none text-[11px] font-semibold uppercase text-slate-400">{i === 0 ? 'When' : match}</span>
          <span className="text-slate-700">
            {c.property} <span className="text-slate-400">{RULE_OPERATOR_LABELS[c.operator].toLowerCase()}</span>{' '}
            <span className="rounded-md bg-slate-100 px-[6px] py-[2px] font-medium text-slate-800">{c.value || '…'}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Name and rules for a custom audience. */
function RulesEditor({ audience, onChange, onDone }: { audience: Audience; onChange: (a: Audience) => void; onDone: () => void }) {
  return (
    <div className="space-y-[10px]">
      <label className="block">
        <span className="mb-[4px] block text-[12px] font-medium text-slate-600">Audience name</span>
        <input
          value={audience.name}
          onChange={(e) => onChange({ ...audience, name: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-[10px] py-[6px] text-[13px] outline-none focus:border-slate-400"
        />
      </label>
      <RuleBuilder
        conditions={audience.conditions ?? []}
        match={audience.match ?? 'AND'}
        onChange={(conditions, match) => onChange({ ...audience, conditions, match: match ?? audience.match ?? 'AND', savedAudienceId: null })}
      />
      <div className="flex justify-end">
        <SButton size="small" variant="neutral-outline" className="w-auto" onClick={onDone}>
          Done
        </SButton>
      </div>
    </div>
  )
}

/** A searchable list of saved audiences, plus the custom one in use. */
function AudienceSelect({
  value,
  placeholder,
  onPick,
  className = '',
}: {
  value: Audience | null
  placeholder: string
  onPick: (a: Audience) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useOutside(open, ref, () => setOpen(false))
  const custom = value && !value.targetAll && !value.savedAudienceId && !audienceUnset(value) ? value : null
  const options = [
    ...AUDIENCE_LIBRARY.map((a) => ({ key: a.id, label: a.name, pick: () => savedAudience(a.id) })),
    ...(custom ? [{ key: custom.id, label: custom.name || 'Custom audience', pick: () => custom }] : []),
  ].filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
  const shown = value && !value.targetAll && !audienceUnset(value) ? audienceText(value) : null
  return (
    <div ref={ref} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-[32px] w-full items-center gap-[6px] rounded-lg border border-slate-200 bg-white px-[10px] text-left text-[12.5px] hover:border-slate-300"
      >
        <span className={`min-w-0 flex-1 truncate ${shown ? 'text-slate-800' : 'text-slate-400'}`}>{shown ?? placeholder}</span>
        <SIcon name="chevron-down" size={13} className="flex-none text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-[4px] rounded-xl border border-slate-200 bg-white p-[6px] shadow-[0_12px_40px_rgba(15,23,42,0.16)]">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="mb-[4px] w-full rounded-lg border border-slate-200 px-[8px] py-[5px] text-[12.5px] outline-none focus:border-slate-400"
          />
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                onPick(o.pick())
                setOpen(false)
                setQ('')
              }}
              className="block w-full truncate rounded-lg px-[8px] py-[6px] text-left text-[12.5px] text-slate-700 hover:bg-slate-100"
            >
              {o.label}
            </button>
          ))}
          {options.length === 0 && <p className="px-[8px] py-[6px] text-[12px] text-slate-400">No audience by that name.</p>}
        </div>
      )}
    </div>
  )
}

function usePageTitle() {
  const threads = useWorkspace((s) => s.threads)
  return (id: string) => threads.find((t) => t.id === id)?.title ?? 'Missing page'
}

/** Pick the cancel page for one row. `rowId` null fills the group's only page. */
function PageSelect({
  play,
  group,
  rowId,
  value,
  placeholder = 'Select cancel page…',
  className = '',
}: {
  play: CancelPlay
  group: string | null
  rowId: string | null
  value: string | null
  placeholder?: string
  className?: string
}) {
  const threads = useWorkspace((s) => s.threads)
  const list = useMemo(() => orderedThreads(threads), [threads])
  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const id = e.target.value
        if (!id) return
        if (id === '__new') {
          const created = createExperience()
          setRowPage(play.id, group, rowId, created)
          useWorkspaceUi.setState({ playId: play.id })
          toast('New cancel page added. Build it here, then come back to the play.')
          return
        }
        if (!setRowPage(play.id, group, rowId, id)) toast('That page is already in this test')
      }}
      className={`h-[32px] min-w-0 rounded-lg border border-slate-200 bg-white px-[8px] text-[12.5px] outline-none focus:border-slate-400 ${value ? 'text-slate-800' : 'text-slate-400'} ${className}`}
    >
      <option value="">{placeholder}</option>
      {list.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title}
        </option>
      ))}
      <option value="__new">+ New cancel page</option>
    </select>
  )
}

function PageTools({ play, experienceId, onTest }: { play: CancelPlay; experienceId: string | null; onTest?: () => void }) {
  const open = (tab: 'preview' | 'editor') => {
    if (!experienceId) return
    openExperience(experienceId, play.id)
    if (tab === 'preview') useWorkspaceUi.setState({ previewAs: '' })
    openTab(tab)
  }
  return (
    <>
      <IconButton icon="eye" label="Preview this page" disabled={!experienceId} onClick={() => open('preview')} />
      <IconButton icon="pencil" label="Edit this page" disabled={!experienceId} onClick={() => open('editor')} />
      {onTest && <IconButton icon="split" label="Test it against another page" onClick={onTest} />}
    </>
  )
}

type Row = { kind: 'page'; v: PlayVariant } | { kind: 'empty'; r: EmptyRow }

function rowsOf(play: CancelPlay, group: string | null): Row[] {
  return [
    ...play.variants.filter((v) => groupOf(play, v) === group).map((v): Row => ({ kind: 'page', v })),
    ...play.emptyRows.filter((r) => r.subAudienceId === group).map((r): Row => ({ kind: 'empty', r })),
  ]
}

/** A test: one row per page, each with its share of the traffic. */
function TestRows({ play, group }: { play: CancelPlay; group: string | null }) {
  const rows = rowsOf(play, group)
  const total = rows.reduce((a, row) => a + (row.kind === 'page' ? row.v.weight : row.r.weight), 0)
  return (
    <div>
      <div className="space-y-[8px]">
        {rows.map((row) => {
          const id = row.kind === 'page' ? row.v.id : row.r.id
          const weight = row.kind === 'page' ? row.v.weight : row.r.weight
          const exp = row.kind === 'page' ? row.v.experienceId : null
          return (
            <div key={id} className="flex items-center gap-[6px]">
              <PageSelect play={play} group={group} rowId={id} value={exp} className="w-[34%] flex-none" />
              <PageTools play={play} experienceId={exp} />
              <input
                type="range"
                min={0}
                max={100}
                value={weight}
                aria-label="Share of traffic"
                onChange={(e) => setRowWeight(play.id, id, Number(e.target.value))}
                className="min-w-0 flex-1 accent-[#1a56db]"
              />
              <label className="flex h-[32px] w-[64px] flex-none items-center rounded-lg border border-slate-200 bg-white px-[6px] text-[12.5px]">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weight}
                  aria-label="Share of traffic in percent"
                  onChange={(e) => setRowWeight(play.id, id, Number(e.target.value) || 0)}
                  className="w-full min-w-0 bg-transparent text-right tabular-nums outline-none"
                />
                <span className="pl-[2px] text-slate-400">%</span>
              </label>
              <IconButton icon="x" label="Remove this row" disabled={rows.length <= 2} onClick={() => removeRow(play.id, id)} />
            </div>
          )
        })}
      </div>
      {total !== 100 && <p className="mt-[8px] text-[12px] font-medium text-rose-600">The shares add up to {total}%. Make it 100%.</p>}
      <div className="mt-[10px] flex items-center gap-[12px] border-t border-slate-100 pt-[10px]">
        <button
          type="button"
          onClick={() => addRow(play.id, group)}
          className="flex h-[32px] flex-1 items-center justify-center gap-[6px] rounded-lg border border-slate-200 text-[12.5px] font-medium text-[#1a56db] hover:bg-slate-50"
        >
          <SIcon name="plus" size={13} /> Add cancel page
        </button>
        <button type="button" onClick={() => evenWeightsIn(play.id, group)} className="flex items-center gap-[5px] text-[12.5px] text-slate-600 hover:text-slate-900">
          <SIcon name="percent" size={13} /> Distribute traffic evenly
        </button>
      </div>
    </div>
  )
}

/* ── Step 1: Audience ────────────────────────────────────────── */

function AudienceStep({ play }: { play: CancelPlay }) {
  const [editing, setEditing] = useState(false)
  const all = Boolean(play.audience.targetAll)
  const picked = !all && !audienceUnset(play.audience)
  const set = (audience: Audience) => updatePlay(play.id, { audience })
  return (
    <div>
      <div className="flex items-start gap-[12px]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold text-slate-900">Choose your audience</h2>
          <p className="mt-[4px] text-[12.5px] text-slate-500">Select an existing audience or create a new one to target with your play.</p>
        </div>
        <div className="pt-[22px]">
          <Toggle
            label="Target all subscribers"
            on={all}
            onChange={(on) => {
              setEditing(false)
              set(on ? ALL_AUDIENCE : customAudience(''))
            }}
          />
        </div>
      </div>
      {!all && (
        <div className="mt-[16px] flex items-center gap-[8px]">
          <AudienceSelect
            value={play.audience}
            placeholder="Search or select an audience…"
            onPick={(a) => {
              setEditing(false)
              set(a)
            }}
            className="flex-1"
          />
          {picked && (
            <IconButton
              icon="pencil"
              label="Edit the rules"
              onClick={() => {
                if (play.audience.savedAudienceId) set(customAudience(play.audience.name, play.audience))
                setEditing(true)
              }}
            />
          )}
          <button
            type="button"
            onClick={() => {
              set(customAudience('New audience'))
              setEditing(true)
            }}
            className="flex h-[32px] flex-none items-center gap-[6px] rounded-lg border border-[#1a56db]/40 bg-[#1a56db]/5 px-[10px] text-[12.5px] font-medium text-[#1a56db] hover:bg-[#1a56db]/10"
          >
            <SIcon name="plus" size={13} /> Create new audience
          </button>
        </div>
      )}
      {(picked || editing || all) && (
        <Card className="mt-[16px]">
          <CardTitle icon="users">{all ? 'All subscribers' : play.audience.name || 'New audience'}</CardTitle>
          {editing && !all ? (
            <RulesEditor
              audience={play.audience}
              onChange={set}
              onDone={() => setEditing(false)}
            />
          ) : (
            <RulesList audience={play.audience} />
          )}
        </Card>
      )}
    </div>
  )
}

/* ── Step 2: Targeting & Experimentation ─────────────────────── */

type Mode = 'show' | 'test' | 'segments'

function modeOf(play: CancelPlay): Mode | null {
  if (play.splitBy === 'segments') return 'segments'
  const rows = play.variants.length + play.emptyRows.length
  if (rows > 1) return 'test'
  return rows === 1 ? 'show' : null
}

const ACTIONS: { mode: Mode; icon: SIconName; title: string; hint: string }[] = [
  { mode: 'show', icon: 'layout-grid', title: 'Show cancel page', hint: 'Display cancel page to the targeted audience' },
  { mode: 'test', icon: 'split', title: 'Test cancel pages', hint: 'Run tests with different cancel pages' },
  { mode: 'segments', icon: 'users', title: 'Add sub-audience', hint: 'Create targeted sub-audience segments to show or test cancel pages' },
]

function SubAudienceCard({ play, index }: { play: CancelPlay; index: number }) {
  const sub = play.subAudiences[index]
  const [editing, setEditing] = useState(false)
  const rows = rowsOf(play, sub.id)
  const only = rows.length === 1 && rows[0].kind === 'page' ? rows[0].v : null
  const label = audienceName(sub.audience, `Sub-audience ${index + 1}`)
  const unset = audienceUnset(sub.audience)
  return (
    <Card>
      <CardTitle
        icon="users"
        action={
          <RowMenu
            label={`Actions for ${label}`}
            icon="ellipsis-vertical"
            items={[
              {
                label: 'Edit rules',
                icon: 'pencil',
                onClick: () => {
                  if (sub.audience.savedAudienceId || unset) setSubAudience(play.id, sub.id, customAudience(unset ? `Sub-audience ${index + 1}` : sub.audience.name, sub.audience))
                  setEditing(true)
                },
              },
              ...(rows.length > 1 ? [{ label: 'Show one page instead', icon: 'layout-grid' as const, onClick: () => rows.slice(1).forEach((r) => removeRow(play.id, r.kind === 'page' ? r.v.id : r.r.id)) }] : []),
              { label: 'Remove sub-audience', icon: 'trash-2', danger: true, confirm: 'Remove it and its pages?', onClick: () => removeSubAudience(play.id, sub.id) },
            ]}
          />
        }
      >
        Sub-audience {play.subAudiences.length > 1 ? index + 1 : ''}
      </CardTitle>
      <div className="flex items-center gap-[6px] text-[12.5px] text-slate-600">
        <span className="flex-none">Send</span>
        <AudienceSelect
          value={unset ? null : sub.audience}
          placeholder={`Select sub-audience ${index + 1}`}
          onPick={(a) => setSubAudience(play.id, sub.id, a)}
          className={rows.length <= 1 ? 'w-[32%] flex-none' : 'flex-1'}
        />
        {rows.length <= 1 ? (
          <>
            <span className="flex-none whitespace-nowrap">to cancel page</span>
            <PageSelect play={play} group={sub.id} rowId={only?.id ?? (rows[0]?.kind === 'empty' ? rows[0].r.id : null)} value={only?.experienceId ?? null} className="w-0 min-w-0 flex-1" />
            <PageTools play={play} experienceId={only?.experienceId ?? null} onTest={() => addRow(play.id, sub.id)} />
          </>
        ) : (
          <span className="flex-none whitespace-nowrap">to a test of these pages</span>
        )}
      </div>
      {rows.length > 1 && (
        <div className="mt-[12px]">
          <TestRows play={play} group={sub.id} />
        </div>
      )}
      {editing && (
        <div className="mt-[12px] border-t border-slate-100 pt-[12px]">
          <RulesEditor audience={sub.audience} onChange={(a) => setSubAudience(play.id, sub.id, a)} onDone={() => setEditing(false)} />
        </div>
      )}
    </Card>
  )
}

function TargetingStep({ play, goTo }: { play: CancelPlay; goTo: (s: ConfigureStep) => void }) {
  const [choosing, setChoosing] = useState(false)
  const [picked, setPicked] = useState<Mode | null>(null)
  const current = modeOf(play) ?? picked
  const mode = choosing ? null : current
  const fallback = fallbackVariant(play)
  const single = play.splitBy === 'percent' ? play.variants[0] : undefined

  const choose = (m: Mode) => {
    setChoosing(false)
    setPicked(m)
    if (m !== current || m === 'segments') setAction(play.id, m)
  }

  return (
    <div className="space-y-[14px]">
      <div>
        <h2 className="text-[17px] font-semibold text-slate-900">Targeting & Experimentation</h2>
        <p className="mt-[4px] text-[12.5px] text-slate-500">Set up targeting rules and experimentation settings to optimize your play's performance.</p>
      </div>
      <Card className="flex items-center gap-[12px]">
        <span className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-full bg-[#1a56db]/10 text-[#1a56db]">
          <SIcon name="users" size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] text-slate-500">Audience</p>
          <p className="truncate text-[13.5px] font-semibold text-slate-900">{audienceName(play.audience, 'Not picked yet')}</p>
        </div>
        <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => goTo(1)}>
          Change
        </SButton>
      </Card>

      {!mode ? (
        <Card>
          <CardTitle icon="zap">Actions</CardTitle>
          <p className="-mt-[4px] mb-[10px] text-[12.5px] text-slate-500">Choose an action for the targeted audience:</p>
          <div className="space-y-[8px]">
            {ACTIONS.map((a) => (
              <button
                key={a.mode}
                type="button"
                onClick={() => choose(a.mode)}
                className={`flex w-full items-center gap-[12px] rounded-lg border px-[12px] py-[10px] text-left transition-colors hover:border-slate-300 hover:bg-slate-50 ${
                  current === a.mode ? 'border-[#1a56db]/50 bg-[#1a56db]/5' : 'border-slate-200'
                }`}
              >
                <SIcon name={a.icon} size={15} className="flex-none text-slate-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-slate-900">{a.title}</span>
                  <span className="block text-[12px] text-slate-500">{a.hint}</span>
                </span>
                {current === a.mode && <SIcon name="check" size={14} className="flex-none text-[#1a56db]" />}
              </button>
            ))}
          </div>
          {current && (
            <p className="mt-[10px] text-[12px] text-slate-500">Picking a different action keeps the pages it can. One page keeps the first.</p>
          )}
        </Card>
      ) : (
        <>
          <button type="button" onClick={() => setChoosing(true)} className="flex items-center gap-[5px] text-[12.5px] font-medium text-[#1a56db] hover:underline">
            <SIcon name="arrow-left" size={13} /> Back to actions
          </button>
          {mode === 'show' && (
            <Card>
              <CardTitle icon="layout-grid">Cancel page</CardTitle>
              <div className="flex flex-wrap items-center gap-[6px] text-[12.5px] text-slate-600">
                <span>Select a cancel page to send the targeted audience to:</span>
                <PageSelect play={play} group={null} rowId={single?.id ?? null} value={single?.experienceId ?? null} className="min-w-[160px] flex-1" />
                <PageTools play={play} experienceId={single?.experienceId ?? null} onTest={() => choose('test')} />
              </div>
            </Card>
          )}
          {mode === 'test' && (
            <Card>
              <CardTitle icon="split">Test cancel pages</CardTitle>
              <TestRows play={play} group={null} />
            </Card>
          )}
          {mode === 'segments' && (
            <>
              {play.subAudiences.map((x, i) => (
                <SubAudienceCard key={x.id} play={play} index={i} />
              ))}
              <button
                type="button"
                onClick={() => addSubAudience(play.id)}
                className="flex h-[34px] w-full items-center justify-center gap-[6px] rounded-lg border border-dashed border-[#1a56db]/50 bg-white text-[12.5px] font-medium text-[#1a56db] hover:bg-[#1a56db]/5"
              >
                <SIcon name="plus" size={13} /> Add sub-audience
              </button>
              <Card>
                <CardTitle icon="shield">Fallback</CardTitle>
                <p className="-mt-[6px] mb-[10px] text-[12px] text-slate-500">For users who don't match any sub-audience</p>
                <div className="flex items-center gap-[6px]">
                  <PageSelect play={play} group={null} rowId={fallback?.id ?? null} value={fallback?.experienceId ?? null} placeholder="Fallback cancel page…" className="min-w-0 flex-1" />
                  <PageTools play={play} experienceId={fallback?.experienceId ?? null} />
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ── Step 3: Review & Publish ────────────────────────────────── */

/** The play's routing as an indented list: the same shape as the left pane. */
export function RoutingTree({ play }: { play: CancelPlay }) {
  const title = usePageTitle()
  const page = (v: PlayVariant, share: boolean) => (
    <div key={v.id} className="flex items-center gap-[6px] text-[12.5px] text-slate-700">
      <SIcon name="layout-template" size={12} className="flex-none text-slate-400" />
      <span className="min-w-0 flex-1 truncate">{title(v.experienceId)}</span>
      {share && <span className="flex-none tabular-nums text-slate-400">{v.weight}%</span>}
    </div>
  )
  if (play.splitBy === 'percent') {
    if (play.variants.length === 0) return <p className="text-[12.5px] text-slate-400">No cancel page yet.</p>
    return <div className="space-y-[4px]">{play.variants.map((v) => page(v, play.variants.length > 1))}</div>
  }
  const fb = fallbackVariant(play)
  return (
    <div className="space-y-[8px]">
      {play.subAudiences.map((x, i) => {
        const pages = pagesIn(play, x.id)
        return (
          <div key={x.id}>
            <div className="flex items-center gap-[6px] text-[12.5px] font-medium text-slate-800">
              <SIcon name="users" size={12} className="flex-none text-slate-400" />
              {audienceName(x.audience, `Sub-audience ${i + 1}`)}
            </div>
            <div className="ml-[5px] mt-[3px] space-y-[3px] border-l border-slate-200 pl-[12px]">
              {pages.length ? pages.map((v) => page(v, pages.length > 1)) : <p className="text-[12px] text-slate-400">No page yet</p>}
            </div>
          </div>
        )
      })}
      <div>
        <div className="flex items-center gap-[6px] text-[12.5px] font-medium text-slate-800">
          <SIcon name="shield" size={12} className="flex-none text-slate-400" />
          Fallback
        </div>
        <div className="ml-[5px] mt-[3px] border-l border-slate-200 pl-[12px]">{fb ? page(fb, false) : <p className="text-[12px] text-slate-400">No page yet</p>}</div>
      </div>
    </div>
  )
}

function ReviewStep({ play, goTo }: { play: CancelPlay; goTo: (s: ConfigureStep) => void }) {
  const inputs = useSetupInputs()
  const open = failing(playChecks(play.id, inputs))
  const live = play.status === 'live'
  const stepFor = (item: string): ConfigureStep => (item === 'audience' ? 1 : 2)
  return (
    <div className="space-y-[14px]">
      <div>
        <h2 className="text-[17px] font-semibold text-slate-900">Review & Publish</h2>
        <p className="mt-[4px] text-[12.5px] text-slate-500">Check who sees this play and which pages they get, then publish it.</p>
      </div>
      <Card>
        <CardTitle icon="users" action={<button type="button" onClick={() => goTo(1)} className="text-[12px] font-medium text-[#1a56db] hover:underline">Edit</button>}>
          Audience: {audienceName(play.audience, 'Not picked yet')}
        </CardTitle>
        <RulesList audience={play.audience} />
      </Card>
      <Card>
        <CardTitle icon="workflow" action={<button type="button" onClick={() => goTo(2)} className="text-[12px] font-medium text-[#1a56db] hover:underline">Edit</button>}>
          Routing
        </CardTitle>
        <RoutingTree play={play} />
      </Card>
      <Card>
        <CardTitle icon="flask-conical">Control group</CardTitle>
        <div className="flex items-center gap-[10px]">
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={play.control}
            aria-label="Control group"
            onChange={(e) => updatePlay(play.id, { control: Number(e.target.value) })}
            className="min-w-0 flex-1 accent-[#1a56db]"
          />
          <span className="w-[36px] flex-none text-right text-[12.5px] tabular-nums text-slate-600">{play.control === 0 ? 'Off' : `${play.control}%`}</span>
        </div>
        <p className="mt-[6px] text-[12px] text-slate-500">
          {play.control === 0 ? 'Everyone in the audience gets a cancel page.' : `${play.control}% of this audience cancels with no cancel page, so you can measure what the play saves.`}
        </p>
      </Card>
      {open.length > 0 && !live && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardTitle icon="circle-alert">Before you publish</CardTitle>
          <ul className="space-y-[6px]">
            {open.map((c) => (
              <li key={c.id} className="flex items-start gap-[8px] text-[12.5px]">
                <span className="mt-[6px] h-[5px] w-[5px] flex-none rounded-full bg-amber-500" />
                <span className="min-w-0 flex-1 text-slate-700">
                  <span className="font-medium text-slate-900">{c.label}.</span> {c.fix}
                </span>
                {(c.item === 'audience' || c.item === 'split' || c.item === 'variants') && (
                  <button type="button" onClick={() => goTo(stepFor(c.item))} className="flex-none text-[12px] font-medium text-[#1a56db] hover:underline">
                    Fix
                  </button>
                )}
                {c.openExperienceId && (
                  <button type="button" onClick={() => openExperience(c.openExperienceId!, play.id)} className="flex-none text-[12px] font-medium text-[#1a56db] hover:underline">
                    Open
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="flex items-center justify-end gap-[8px]">
        {live && <span className="text-[12.5px] text-emerald-700">This play is live.</span>}
        <SButton
          size="small"
          variant={live ? 'neutral-outline' : 'primary'}
          className="w-auto"
          disabled={!live && open.length > 0}
          onClick={() => {
            setPlayLive(play.id, !live)
            toast(live ? `Paused ${play.name}` : `${play.name} is live`)
          }}
        >
          {live ? 'Pause play' : 'Publish play'}
        </SButton>
      </div>
    </div>
  )
}

/* ── The wizard ──────────────────────────────────────────────── */

function Stepper({ step, done, goTo }: { step: ConfigureStep; done: Record<ConfigureStep, boolean>; goTo: (s: ConfigureStep) => void }) {
  return (
    <ol className="flex min-w-0 flex-1 items-start">
      {STEPS.map((s, i) => {
        const on = s.step === step
        const ok = done[s.step] && !on
        return (
          <li key={s.step} className="flex min-w-0 flex-1 items-start">
            <button type="button" onClick={() => goTo(s.step)} className="flex min-w-0 flex-1 flex-col items-center gap-[6px]">
              <span className="relative flex w-full items-center justify-center">
                {i > 0 && <span className={`absolute right-1/2 top-1/2 h-[2px] w-full -translate-y-1/2 ${done[STEPS[i - 1].step] ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
                <span
                  className={`relative z-10 flex h-[20px] w-[20px] items-center justify-center rounded-full text-[10.5px] font-bold ${
                    on ? 'bg-slate-900 text-white' : ok ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {ok ? <SIcon name="check" size={11} /> : s.step}
                </span>
              </span>
              <span className={`truncate px-[4px] text-[12px] ${on ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{s.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** A play's Configure tab: set it up one step at a time. */
export function PlayConfigure({ play }: { play: CancelPlay }) {
  const step = useWorkspaceUi((s) => s.configureStep[play.id] ?? 1)
  const goTo = (s: ConfigureStep) => useWorkspaceUi.getState().setConfigureStep(play.id, s)
  const done: Record<ConfigureStep, boolean> = { 1: audienceDone(play), 2: targetingDone(play), 3: play.status === 'live' }
  const prev = STEPS.find((s) => s.step === step - 1)
  const next = STEPS.find((s) => s.step === step + 1)
  const blocked = step === 1 && !done[1]

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="flex flex-none items-center gap-[12px] border-b border-slate-200 bg-white px-[16px] py-[10px]">
        <Stepper step={step} done={done} goTo={goTo} />
        <div className="flex flex-none items-center gap-[6px]">
          {prev && (
            <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => goTo(prev.step)}>
              <span className="inline-flex items-center gap-[4px]">
                <SIcon name="arrow-left" size={12} /> {prev.label}
              </span>
            </SButton>
          )}
          {next && (
            <span title={blocked ? 'Pick an audience first' : undefined}>
              <SButton size="small" variant="primary" className="w-auto" disabled={blocked} onClick={() => goTo(next.step)}>
                <span className="inline-flex items-center gap-[4px]">
                  {next.label} <SIcon name="arrow-right" size={12} />
                </span>
              </SButton>
            </span>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[620px] px-[24px] py-[24px]">
          {step === 1 && <AudienceStep play={play} />}
          {step === 2 && <TargetingStep play={play} goTo={goTo} />}
          {step === 3 && <ReviewStep play={play} goTo={goTo} />}
        </div>
      </div>
    </div>
  )
}
