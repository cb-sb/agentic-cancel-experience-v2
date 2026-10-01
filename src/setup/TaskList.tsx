import type { ReactNode } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { StatusChip } from '../layout/StatusChip'
import { openExperience, openPlayTab } from '../plays/navigate'
import { variantLetter } from '../plays/types'
import { usePlays, usePlaysUsing, useRankedPlays } from '../plays/usePlays'
import { openTab } from '../workspace/paneTabs'
import { useWorkspace } from '../workspace/useWorkspace'
import { doInChat, openItem } from './actions'
import { experienceChecks, failing, playChecks, type CheckResult } from './checks'
import { experienceCtx, experienceRows, playRows, useSetupInputs, type SetupInputs } from './progress'
import { experienceMap, playMap, tryItMap, workspaceMap, type MapRow } from './setupMap'

type Gate = 'publish' | 'go live'

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex items-baseline justify-between gap-[12px] border-b border-slate-100 px-[14px] py-[10px]">
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        {hint && <span className="truncate text-[12px] text-slate-400">{hint}</span>}
      </header>
      <ul>{children}</ul>
    </section>
  )
}

function Row({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  const body = <>{children}</>
  return (
    <li className="border-t border-slate-100 first:border-t-0">
      {onClick ? (
        <button type="button" onClick={onClick} className="group flex w-full items-center gap-[12px] px-[14px] py-[9px] text-left transition-colors hover:bg-slate-50">
          {body}
          <SIcon name="chevron-right" size={14} className="flex-none text-slate-300 group-hover:text-slate-500" />
        </button>
      ) : (
        <div className="flex items-center gap-[12px] px-[14px] py-[9px]">{body}</div>
      )}
    </li>
  )
}

function openCheck(c: CheckResult, playId?: string) {
  if (c.openExperienceId) {
    openExperience(c.openExperienceId, playId ?? null)
    openTab('tasks')
    return
  }
  openItem(c.item, c.targetId)
}

function Checks({ checks, gate, live, playId }: { checks: CheckResult[]; gate: Gate; live: boolean; playId?: string }) {
  if (checks.length === 0) return null
  const open = failing(checks).length
  return (
    <Card title={live ? 'Launch checks' : `Before you can ${gate}`} hint={open === 0 ? 'All passing' : `${open} to fix`}>
      {checks.map((c) => (
        <Row key={c.id} onClick={c.met ? undefined : () => openCheck(c, playId)}>
          <SIcon name={c.met ? 'circle-check' : 'circle'} size={16} className={`flex-none ${c.met ? 'text-emerald-600' : 'text-slate-300'}`} />
          <span className="min-w-0 flex-1">
            <span className={`block text-[13px] ${c.met ? 'text-slate-500' : 'font-medium text-slate-900'}`}>{c.label}</span>
            {!c.met && <span className="block truncate text-[12px] text-slate-500">{c.fix}</span>}
          </span>
        </Row>
      ))}
    </Card>
  )
}

function Settings({ title, hint, rows, checks, gate }: { title: string; hint?: string; rows: MapRow[]; checks: CheckResult[]; gate: Gate }) {
  if (rows.length === 0) return null
  const failed = new Set(failing(checks).map((c) => c.id))
  return (
    <Card title={title} hint={hint}>
      {rows.map((r) => {
        const bad = Boolean(r.check && failed.has(r.check))
        return (
          <Row key={r.id} onClick={() => openItem(r.item, r.targetId)}>
            <span className="w-[210px] flex-none truncate text-[13px] text-slate-500">{r.label}</span>
            <span className={`min-w-0 flex-1 truncate text-[13px] ${bad ? 'font-medium text-rose-600' : 'text-slate-900'}`}>
              {bad ? `${r.value}. Needed to ${gate}` : r.value}
            </span>
          </Row>
        )
      })}
    </Card>
  )
}

function Header({ title, live, checks, gate, onGate }: { title: string; live: boolean; checks: CheckResult[]; gate: Gate; onGate?: () => void }) {
  const open = failing(checks).length
  const line = live
    ? gate === 'publish'
      ? 'Published.'
      : 'Live.'
    : open > 0
      ? `${open === 1 ? 'One check' : `${open} checks`} left before you can ${gate}.`
      : `Ready to ${gate}.`
  return (
    <div className="flex items-center gap-[12px]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[8px]">
          <h2 className="truncate text-[16px] font-semibold text-slate-900">{title}</h2>
          <StatusChip live={live} />
        </div>
        <p className={`mt-[2px] text-[12.5px] ${!live && open === 0 ? 'font-medium text-emerald-700' : 'text-slate-500'}`}>{line}</p>
      </div>
      {!live && open === 0 && onGate && (
        <SButton size="small" variant="primary" className="w-auto flex-none" onClick={onGate}>
          {gate === 'publish' ? 'Publish' : 'Go live'}
        </SButton>
      )}
    </div>
  )
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[720px] flex-col gap-[14px] px-[24px] py-[20px]">{children}</div>
    </div>
  )
}

function experienceState(id: string, i: SetupInputs): string {
  const t = i.threads.find((x) => x.id === id)
  if (!t) return ''
  if (experienceCtx(t, i).live) return 'Live'
  const n = failing(experienceChecks(id, i)).length
  return n === 0 ? 'Draft, ready to publish' : `Draft, ${n === 1 ? 'one check' : `${n} checks`} left`
}

/** The Task list for one experience: what has to pass, then every setting as it stands. */
export function ExperienceTaskList() {
  const inputs = useSetupInputs()
  const activeId = useWorkspace((s) => s.activeId)
  const title = useWorkspace((s) => s.threads.find((t) => t.id === s.activeId)?.title ?? 'This experience')
  const using = usePlaysUsing(activeId)
  const thread = inputs.threads.find((t) => t.id === activeId)
  const live = thread ? experienceCtx(thread, inputs).live : false
  const checks = experienceChecks(activeId, inputs)
  const publish = experienceRows(activeId, inputs).find((r) => r.entry.id === 'publish')
  return (
    <Page>
      <Header title={title} live={live} checks={checks} gate="publish" onGate={publish ? () => doInChat(publish) : undefined} />
      <Checks checks={checks} gate="publish" live={live} />
      <Settings title="This experience" hint="In the order a subscriber sees it" rows={experienceMap(activeId, inputs)} checks={checks} gate="publish" />
      <Card title="Plays" hint="Where this experience is shown">
        {using.map((p) => (
          <Row key={p.id} onClick={() => openPlayTab(p.id, 'tasks')}>
            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900">{p.name}</span>
            <StatusChip live={p.status === 'live'} />
          </Row>
        ))}
        {using.length === 0 && (
          <Row>
            <span className="text-[13px] text-slate-500">Not in a play yet. Add it to one so subscribers can see it.</span>
          </Row>
        )}
      </Card>
      <Settings title="Workspace" hint="Set once for your whole site" rows={workspaceMap(inputs)} checks={[]} gate="publish" />
      <Settings title="Try it" rows={tryItMap('experience', activeId, inputs)} checks={[]} gate="publish" />
    </Page>
  )
}

/** The Task list for a play: what has to pass, its experiences, then every setting as it stands. */
export function PlayTaskList({ playId }: { playId: string }) {
  const inputs = useSetupInputs()
  const play = usePlays((s) => s.plays.find((p) => p.id === playId))
  const order = useRankedPlays().map((p) => p.id)
  if (!play) return null
  const live = play.status === 'live'
  const checks = playChecks(playId, inputs)
  const goLive = playRows(playId, inputs).find((r) => r.entry.id === 'goLive')
  return (
    <Page>
      <Header title={play.name} live={live} checks={checks} gate="go live" onGate={goLive ? () => doInChat(goLive) : undefined} />
      <Checks checks={checks} gate="go live" live={live} playId={playId} />
      <Card title="Experiences in this play" hint="Each one is published on its own">
        {play.variants.map((v, n) => (
          <Row
            key={v.id}
            onClick={() => {
              openExperience(v.experienceId, playId)
              openTab('tasks')
            }}
          >
            <span className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">{variantLetter(n)}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900">{inputs.threads.find((t) => t.id === v.experienceId)?.title ?? 'Experience'}</span>
            <span className="flex-none text-[12px] text-slate-500">{experienceState(v.experienceId, inputs)}</span>
          </Row>
        ))}
        {play.variants.length === 0 && (
          <Row>
            <span className="text-[13px] text-slate-500">No experiences yet.</span>
          </Row>
        )}
      </Card>
      <Settings title="This play" rows={playMap(play, inputs, order)} checks={checks} gate="go live" />
      <Settings title="Workspace" hint="Set once for your whole site" rows={workspaceMap(inputs)} checks={checks} gate="go live" />
      <Settings title="Try it" rows={tryItMap('play', playId, inputs)} checks={[]} gate="go live" />
    </Page>
  )
}
