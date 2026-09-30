import type { JourneyFile } from '../journey/types'
import type { CancelPlay } from '../plays/types'
import { usePlays } from '../plays/usePlays'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { fileOfThread, useWorkspace, type ExperienceThread } from '../workspace/useWorkspace'
import { checksForExperience, failing, playChecks, type CheckResult } from './checks'
import {
  EXPERIENCE_ITEMS,
  PLAY_ITEMS,
  WORKSPACE_ITEMS,
  WORKSPACE_TARGET,
  type ExperienceCtx,
  type PlayCtx,
  type SetupEntry,
  type TaskStatus,
  type WorkspaceCtx,
} from './registry'
import { markKey, useSetupState, type Mark } from './useSetupState'

export interface TaskRow {
  entry: SetupEntry
  status: TaskStatus
  mark?: Mark
  targetId: string
  /** Labels of the items this one is waiting on. */
  waitingOn: string[]
}

export interface SetupInputs {
  threads: ExperienceThread[]
  activeId: string
  activeFile: JourneyFile
  activeLive: boolean
  activeWalked: boolean
  installConnected: boolean
  plays: CancelPlay[]
  marks: Record<string, Mark>
  ws: ReturnType<typeof useSetupState.getState>['workspace']
  tested: Record<string, number>
}

const GATES = new Set(['publish', 'goLive'])

function status(done: boolean, mark: Mark | undefined, waiting: boolean): TaskStatus {
  if (done) return 'done'
  if (mark?.status === 'na') return 'na'
  if (waiting) return 'waiting'
  if (mark?.status === 'skipped') return 'skipped'
  return 'todo'
}

function evaluate<C>(
  items: { id: string; label: string; dependsOn?: string[]; applies?: (c: C) => boolean; isDone: (c: C, m?: Mark) => boolean }[],
  entries: SetupEntry[],
  ctx: C,
  targetId: string,
  marks: Record<string, Mark>,
): TaskRow[] {
  const live = items.filter((i) => !i.applies || i.applies(ctx))
  const done = new Map(live.map((i) => [i.id, i.isDone(ctx, marks[markKey(targetId, i.id)])]))
  return live.map((item) => {
    const mark = marks[markKey(targetId, item.id)]
    const waitingOn = (item.dependsOn ?? [])
      .map((d) => {
        if (!done.has(d)) return null
        return done.get(d) ? null : live.find((x) => x.id === d)?.label ?? null
      })
      .filter((x): x is string => Boolean(x))
    return {
      entry: entries.find((e) => e.id === item.id) ?? entries[items.indexOf(item)],
      status: status(done.get(item.id) ?? false, mark, waitingOn.length > 0),
      mark,
      targetId,
      waitingOn,
    }
  })
}

function threadLive(t: ExperienceThread, i: SetupInputs): boolean {
  if (t.id === i.activeId) return i.activeLive
  return t.snapshot?.play.publishState === 'live'
}

export function experienceCtx(t: ExperienceThread, i: SetupInputs): ExperienceCtx {
  const active = t.id === i.activeId
  return {
    experienceId: t.id,
    file: active ? i.activeFile : fileOfThread(t),
    live: threadLive(t, i),
    walked: active ? i.activeWalked : Boolean(t.snapshot?.setup?.walkedOrSkipped),
  }
}

/** Publish and Go live wait on the launch checks, and on nothing else. */
function gate(rows: TaskRow[], checks: CheckResult[]): TaskRow[] {
  const open = failing(checks)
  return rows.map((r) =>
    GATES.has(r.entry.id) && r.status !== 'done'
      ? { ...r, status: (open.length > 0 ? 'waiting' : 'todo') as TaskStatus, waitingOn: open.map((c) => c.label) }
      : r,
  )
}

export function experienceRows(experienceId: string, i: SetupInputs): TaskRow[] {
  const t = i.threads.find((x) => x.id === experienceId)
  if (!t) return []
  const ctx = experienceCtx(t, i)
  return gate(evaluate(EXPERIENCE_ITEMS, EXPERIENCE_ITEMS, ctx, experienceId, i.marks), checksForExperience(ctx))
}

function experienceReady(experienceId: string, i: SetupInputs): boolean {
  const t = i.threads.find((x) => x.id === experienceId)
  return Boolean(t) && failing(checksForExperience(experienceCtx(t!, i))).length === 0
}

export function playCtx(play: CancelPlay, i: SetupInputs): PlayCtx {
  const ids = play.variants.map((v) => v.experienceId)
  const threads = ids.map((id) => i.threads.find((t) => t.id === id)).filter((t): t is ExperienceThread => Boolean(t))
  return {
    play,
    playCount: i.plays.length,
    variantsReady: { ready: threads.filter((t) => experienceReady(t.id, i)).length, total: threads.length },
    variantsLive: { live: threads.filter((t) => threadLive(t, i)).length, total: threads.length },
    tested: Boolean(i.tested[play.id]),
  }
}

export function playRows(playId: string, i: SetupInputs): TaskRow[] {
  const play = i.plays.find((p) => p.id === playId)
  if (!play) return []
  return gate(evaluate(PLAY_ITEMS, PLAY_ITEMS, playCtx(play, i), playId, i.marks), playChecks(playId, i))
}

export function workspaceCtx(i: SetupInputs): WorkspaceCtx {
  return { installConnected: i.installConnected, ws: i.ws, anyLive: i.plays.some((p) => p.status === 'live') }
}

export function workspaceRows(i: SetupInputs): TaskRow[] {
  return evaluate(WORKSPACE_ITEMS, WORKSPACE_ITEMS, workspaceCtx(i), WORKSPACE_TARGET, i.marks)
}

/** Everything the checklist reads, subscribed, so tasks update the moment anything changes. */
export function useSetupInputs(): SetupInputs {
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const wsInstall = useWorkspace((s) => s.installConnected)
  const activeFile = useJourney((s) => s.file)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  const activeWalked = useOrchestration((s) => s.walkedOrSkipped)
  const orchInstall = useOrchestration((s) => s.installConnected)
  const plays = usePlays((s) => s.plays)
  const marks = useSetupState((s) => s.marks)
  const ws = useSetupState((s) => s.workspace)
  const tested = useSetupState((s) => s.tested)
  return {
    threads,
    activeId,
    activeFile,
    activeLive,
    activeWalked,
    installConnected: wsInstall || orchInstall,
    plays,
    marks,
    ws,
    tested,
  }
}

export function readSetupInputs(): SetupInputs {
  const w = useWorkspace.getState()
  const o = useOrchestration.getState()
  const s = useSetupState.getState()
  return {
    threads: w.threads,
    activeId: w.activeId,
    activeFile: useJourney.getState().file,
    activeLive: o.play.publishState === 'live',
    activeWalked: o.walkedOrSkipped,
    installConnected: w.installConnected || o.installConnected,
    plays: usePlays.getState().plays,
    marks: s.marks,
    ws: s.workspace,
    tested: s.tested,
  }
}
