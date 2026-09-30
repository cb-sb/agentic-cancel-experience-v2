import { create } from 'zustand'

const KEY = 'cancel-experience:test-sessions:v8'

/** A test run from the canvas or the play order page. These never reach reporting. */
export interface TestSession {
  id: string
  playId: string | null
  subscriberId: string
  subscriberName: string
  result: string
  forced: boolean
  walked: boolean
  at: number
}

function read(): TestSession[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TestSession[]) : []
  } catch {
    return []
  }
}

export const useTestSessions = create<{ sessions: TestSession[] }>(() => ({ sessions: read() }))

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(useTestSessions.getState().sessions))
  } catch {
    /* quota */
  }
}

export function logSession(s: Omit<TestSession, 'id' | 'at'>): string {
  const id = `ts_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  useTestSessions.setState((st) => ({ sessions: [{ ...s, id, at: Date.now() }, ...st.sessions].slice(0, 30) }))
  write()
  return id
}

export function markWalked(id: string) {
  useTestSessions.setState((st) => ({ sessions: st.sessions.map((s) => (s.id === id ? { ...s, walked: true } : s)) }))
  write()
}
