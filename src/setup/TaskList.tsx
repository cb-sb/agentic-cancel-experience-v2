import { SButton, SIcon, type SIconName } from '@chargebee/sting-react'
import { openExperience } from '../plays/navigate'
import { variantLetter } from '../plays/types'
import { usePlays, usePlaysUsing } from '../plays/usePlays'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { doInChat, notNeeded, reopen, showMe, skipForNow } from './actions'
import { experienceRows, playRows, readSetupInputs, summarize, useSetupInputs, workspaceRows, type TaskRow, type TaskSummary } from './progress'
import { openTab } from '../workspace/paneTabs'
import type { Track } from './registry'
import { ProgressRing } from './TaskProgress'

const STATUS: Record<TaskRow['status'], { icon: SIconName; tone: string; dot: string; label: string }> = {
  done: { icon: 'circle-check', tone: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Done' },
  todo: { icon: 'circle', tone: 'text-slate-300', dot: 'bg-slate-300', label: 'Needs you' },
  skipped: { icon: 'skip-forward', tone: 'text-amber-500', dot: 'bg-amber-400', label: 'Skipped' },
  na: { icon: 'circle-slash', tone: 'text-slate-400', dot: 'bg-slate-200', label: 'Not needed' },
  waiting: { icon: 'hourglass', tone: 'text-slate-400', dot: 'bg-slate-200', label: 'Waiting' },
}

const LEVEL: Record<TaskRow['entry']['level'], string> = {
  required: 'Required',
  recommended: 'Recommended',
  optional: 'Optional',
}

const TRACK_LABEL: Record<Track, { title: string; icon: SIconName }> = {
  experience: { title: 'Experience', icon: 'layout-template' },
  play: { title: 'Play', icon: 'workflow' },
  launch: { title: 'Launch', icon: 'rocket' },
}

function ago(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

const BY: Record<string, string> = {
  chat: 'Done by chat',
  summary: 'Done in Summary',
  tasks: 'Marked in Task list',
  canvas: 'Done on the canvas',
  editor: 'Done in the Editor',
  order: 'Set on the Play order page',
}

/** The one line under an item: why it matters, or what it's waiting on, or who did it. */
function reason(row: TaskRow): string {
  if (row.status === 'waiting') return `Waiting on ${row.waitingOn.join(', ').toLowerCase()}`
  if (row.status === 'skipped') return `Skipped ${row.mark ? ago(row.mark.at) : ''}. ${row.entry.why}`
  if (row.status === 'na') return 'Marked as not needed'
  if (row.status === 'done' && row.mark?.status === 'done' && row.mark.by) return `${BY[row.mark.by]} · ${ago(row.mark.at)}`
  return row.entry.why
}

/** Opens the first variant of a play that still has required settings open. */
function openNextUnready(playId: string) {
  const play = usePlays.getState().plays.find((p) => p.id === playId)
  const inputs = readSetupInputs()
  const v = play?.variants.find((x) => !summarize(experienceRows(x.experienceId, inputs)).ready)
  if (!v) return
  openExperience(v.experienceId, playId)
  openTab('tasks')
}

function Actions({ row, compact }: { row: TaskRow; compact?: boolean }) {
  if (row.status === 'done' || row.status === 'waiting') return null
  if (row.entry.id === 'variantsReady' && row.status === 'todo') {
    return (
      <SButton size="small" variant={compact ? 'neutral-outline' : 'primary'} className="w-auto flex-none" onClick={() => openNextUnready(row.targetId)}>
        Open the next one
      </SButton>
    )
  }
  if (row.status === 'na' || row.status === 'skipped') {
    return (
      <div className="flex flex-none items-center gap-[4px]">
        {row.status === 'skipped' && row.entry.chat && (
          <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => doInChat(row)}>
            Do it in chat
          </SButton>
        )}
        <button type="button" onClick={() => reopen(row)} className="rounded-md px-[6px] py-[3px] text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          Undo
        </button>
      </div>
    )
  }
  return (
    <div className={`flex flex-none items-center gap-[4px] ${compact ? 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100' : ''}`}>
      {row.entry.chat && (
        <SButton size="small" variant={compact ? 'neutral-outline' : 'primary'} className="w-auto" onClick={() => doInChat(row)}>
          Do it in chat
        </SButton>
      )}
      {row.entry.showMe && (
        <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => showMe(row)}>
          Show me
        </SButton>
      )}
      {row.entry.level !== 'required' && (
        <button type="button" onClick={() => skipForNow(row)} className="rounded-md px-[6px] py-[3px] text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          Skip for now
        </button>
      )}
      {row.entry.level === 'optional' && (
        <button type="button" onClick={() => notNeeded(row)} className="rounded-md px-[6px] py-[3px] text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          Not needed
        </button>
      )}
    </div>
  )
}

function Item({ row }: { row: TaskRow }) {
  const s = STATUS[row.status]
  const muted = row.status === 'na' || row.status === 'waiting'
  return (
    <li className="group flex items-start gap-[10px] rounded-xl px-[10px] py-[8px] hover:bg-slate-50">
      <SIcon name={s.icon} size={16} className={`mt-[1px] flex-none ${s.tone}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[6px]">
          <span className={`text-[13px] font-medium ${muted ? 'text-slate-400' : row.status === 'done' ? 'text-slate-500' : 'text-slate-900'}`}>{row.entry.label}</span>
          <span
            className={`rounded-full px-[6px] py-[0.5px] text-[10px] font-semibold ${
              row.entry.level === 'required' ? 'bg-rose-50 text-rose-600' : row.entry.level === 'recommended' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {LEVEL[row.entry.level]}
          </span>
          <span className="rounded-full bg-slate-100 px-[6px] py-[0.5px] text-[10px] font-medium text-slate-500">
            {row.entry.scope === 'experience' ? 'This experience' : row.entry.scope === 'play' ? 'Play' : 'Workspace'}
          </span>
        </div>
        <p className="mt-[2px] truncate text-[12px] text-slate-500">{reason(row)}</p>
      </div>
      <Actions row={row} compact />
    </li>
  )
}

/** A strip of dots, one per item, in the order a subscriber-facing launch needs them. */
function JourneyMap({ rows }: { rows: TaskRow[] }) {
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {rows.map((r, i) => (
        <span key={r.entry.id + i} className="flex items-center gap-[3px]">
          {i > 0 && <span className="h-px w-[8px] bg-slate-200" />}
          <span title={`${r.entry.label}: ${STATUS[r.status].label}`} className={`h-[8px] w-[8px] rounded-full ${STATUS[r.status].dot}`} />
        </span>
      ))}
    </div>
  )
}

function TrackSection({ track, rows, extra, subtitle }: { track: Track; rows: TaskRow[]; extra?: React.ReactNode; subtitle?: string }) {
  if (rows.length === 0 && !extra) return null
  const s = summarize(rows)
  const t = TRACK_LABEL[track]
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex items-center gap-[10px] border-b border-slate-100 px-[14px] py-[10px]">
        <SIcon name={t.icon} size={14} className="flex-none text-slate-500" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-slate-900">{t.title}</div>
          {subtitle && <div className="truncate text-[11.5px] text-slate-500">{subtitle}</div>}
        </div>
        {rows.length > 0 && <JourneyMap rows={rows} />}
        {rows.length > 0 && (
          <span className="flex-none text-[11.5px] tabular-nums text-slate-400">
            {s.resolved}/{s.counted}
          </span>
        )}
      </header>
      {extra}
      {rows.length > 0 && (
        <ul className="p-[4px]">
          {rows.map((r) => (
            <Item key={`${r.targetId}:${r.entry.id}`} row={r} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Header({ summary, gate, title }: { summary: TaskSummary; gate: string; title: string }) {
  const { blockers } = summary
  return (
    <div className="flex items-center gap-[14px]">
      <div className="relative flex-none">
        <ProgressRing percent={summary.percent} size={52} stroke={5} />
        <span className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold tabular-nums text-slate-700">{summary.percent}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[16px] font-semibold text-slate-900">{title}</h2>
        <p className="mt-[2px] text-[12.5px] text-slate-500">
          {summary.resolved} of {summary.counted} done.{' '}
          {blockers.length === 0 ? (
            <span className="font-medium text-emerald-700">Ready to {gate}.</span>
          ) : (
            <span>
              {blockers.length} required {blockers.length === 1 ? 'item stands' : 'items stand'} between you and {gate === 'publish' ? 'publishing' : 'going live'}.
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

function NextUp({ row }: { row: TaskRow | null }) {
  if (!row) {
    return (
      <div className="flex items-center gap-[10px] rounded-2xl border border-emerald-200 bg-emerald-50 px-[14px] py-[12px] text-[13px] text-emerald-800">
        <SIcon name="party-popper" size={16} className="flex-none" />
        Nothing left that needs you. Anything skipped is still here if you want it.
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 px-[14px] py-[12px]">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-indigo-500">Next up</div>
      <div className="mt-[4px] flex items-center gap-[12px]">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-slate-900">{row.entry.label}</div>
          <p className="mt-[2px] text-[12.5px] text-slate-600">{row.entry.why}</p>
        </div>
        <Actions row={row} />
      </div>
    </div>
  )
}

function useGoTo() {
  return (id: string) => openExperience(id, useWorkspaceUi.getState().playId)
}

/** The Task list for one experience: its own settings, the play it's in, and launch. */
export function ExperienceTaskList() {
  const inputs = useSetupInputs()
  const activeId = useWorkspace((s) => s.activeId)
  const title = useWorkspace((s) => s.threads.find((t) => t.id === s.activeId)?.title ?? 'This experience')
  const ctxPlayId = useWorkspaceUi((s) => s.playId)
  const using = usePlaysUsing(activeId)
  const play = using.find((p) => p.id === ctxPlayId) ?? using[0] ?? null
  const exp = experienceRows(activeId, inputs)
  const own = exp.filter((r) => r.entry.track === 'experience')
  const launch = [...exp.filter((r) => r.entry.track === 'launch'), ...workspaceRows(inputs)]
  const playTrack = play ? playRows(play.id, inputs).filter((r) => r.entry.track === 'play') : []
  const summary = summarize([...own, ...exp.filter((r) => r.entry.track === 'launch')])
  const next = summary.next ?? summarize([...playTrack, ...launch]).next
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col gap-[14px] px-[24px] py-[20px]">
        <Header summary={summary} gate="publish" title={title} />
        <NextUp row={next} />
        <TrackSection track="experience" rows={own} />
        {play ? (
          <TrackSection track="play" rows={playTrack} subtitle={`${play.name}${using.length > 1 ? `, and ${using.length - 1} more` : ''}`} />
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-200 px-[14px] py-[12px] text-[12.5px] text-slate-500">
            This experience isn't in a play yet. Add it to one so it can be shown to subscribers.
          </section>
        )}
        <TrackSection track="launch" rows={launch} />
      </div>
    </div>
  )
}

/** The Task list for a play: every variant's progress, the play's own settings, and launch. */
export function PlayTaskList({ playId }: { playId: string }) {
  const inputs = useSetupInputs()
  const play = usePlays((s) => s.plays.find((p) => p.id === playId))
  const threads = useWorkspace((s) => s.threads)
  const goTo = useGoTo()
  if (!play) return null
  const rows = playRows(playId, inputs)
  const own = rows.filter((r) => r.entry.track === 'play')
  const launch = [...rows.filter((r) => r.entry.track === 'launch'), ...workspaceRows(inputs)]
  const summary = summarize([...own, ...launch])
  const variants = play.variants.map((v, i) => {
    const s = summarize(experienceRows(v.experienceId, inputs))
    return { v, i, s, title: threads.find((t) => t.id === v.experienceId)?.title ?? 'Experience' }
  })
  const variantList = (
    <ul className="p-[4px]">
      {variants.map(({ v, i, s, title }) => (
        <li key={v.id}>
          <button type="button" onClick={() => goTo(v.experienceId)} className="flex w-full items-center gap-[10px] rounded-xl px-[10px] py-[8px] text-left hover:bg-slate-50">
            <span className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">{variantLetter(i)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-slate-900">{title}</span>
              <span className="block truncate text-[12px] text-slate-500">
                {s.blockers.length === 0 ? 'Required settings done' : `Needs ${s.blockers.map((b) => b.entry.label.toLowerCase()).join(', ')}`}
              </span>
            </span>
            <ProgressRing percent={s.percent} size={18} stroke={2.5} />
            <span className="w-[34px] flex-none text-right text-[11.5px] tabular-nums text-slate-400">
              {s.resolved}/{s.counted}
            </span>
            <SIcon name="chevron-right" size={13} className="flex-none text-slate-300" />
          </button>
        </li>
      ))}
      {variants.length === 0 && <li className="px-[10px] py-[8px] text-[12.5px] text-slate-500">No variants yet.</li>}
    </ul>
  )
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col gap-[14px] px-[24px] py-[20px]">
        <Header summary={summary} gate="go live" title={play.name} />
        <NextUp row={summary.next} />
        <TrackSection track="experience" rows={[]} extra={variantList} subtitle="Each variant is set up on its own" />
        <TrackSection track="play" rows={own} />
        <TrackSection track="launch" rows={launch} />
      </div>
    </div>
  )
}
