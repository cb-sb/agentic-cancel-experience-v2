import { create } from 'zustand'

const KEY = 'cancel-experience:setup:v8'

export type MarkStatus = 'done' | 'skipped' | 'na'
export type DoneBy = 'chat' | 'summary' | 'tasks' | 'canvas' | 'editor' | 'order'

export interface Mark {
  status: MarkStatus
  by?: DoneBy
  at: number
}

/** Settings Chargebee keeps once for the whole site, asked once. */
export interface WorkspaceSetup {
  customDomain: string
  alertEmail: string
  alertSlack: string
  alertWebhook: string
}

interface SetupState {
  /** Keyed `${targetId}:${itemId}`. Target is an experience id, a play id, or `ws`. */
  marks: Record<string, Mark>
  workspace: WorkspaceSetup
  /** Play id to when a subscriber test last ran on it. */
  tested: Record<string, number>
}

const EMPTY_WS: WorkspaceSetup = { customDomain: '', alertEmail: '', alertSlack: '', alertWebhook: '' }

function read(): SetupState {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
    const p = raw ? (JSON.parse(raw) as Partial<SetupState>) : {}
    return { marks: p.marks ?? {}, workspace: { ...EMPTY_WS, ...p.workspace }, tested: p.tested ?? {} }
  } catch {
    return { marks: {}, workspace: EMPTY_WS, tested: {} }
  }
}

export const useSetupState = create<SetupState>(() => read())

function write() {
  try {
    const { marks, workspace, tested } = useSetupState.getState()
    localStorage.setItem(KEY, JSON.stringify({ marks, workspace, tested }))
  } catch {
    /* quota */
  }
}

export const markKey = (targetId: string, itemId: string) => `${targetId}:${itemId}`

export function setMark(targetId: string, itemId: string, status: MarkStatus | null, by?: DoneBy) {
  useSetupState.setState((s) => {
    const marks = { ...s.marks }
    const key = markKey(targetId, itemId)
    if (status) marks[key] = { status, by, at: Date.now() }
    else delete marks[key]
    return { marks }
  })
  write()
}

export function markOf(targetId: string, itemId: string): Mark | undefined {
  return useSetupState.getState().marks[markKey(targetId, itemId)]
}

export function patchWorkspaceSetup(change: Partial<WorkspaceSetup>) {
  useSetupState.setState((s) => ({ workspace: { ...s.workspace, ...change } }))
  write()
}

export function markTested(playId: string) {
  useSetupState.setState((s) => ({ tested: { ...s.tested, [playId]: Date.now() } }))
  write()
}

/** A copied experience starts with the original's answers. */
export function copyMarks(fromId: string, toId: string) {
  useSetupState.setState((s) => {
    const marks = { ...s.marks }
    for (const [key, mark] of Object.entries(s.marks)) {
      if (key.startsWith(`${fromId}:`)) marks[`${toId}:${key.slice(fromId.length + 1)}`] = mark
    }
    return { marks }
  })
  write()
}
