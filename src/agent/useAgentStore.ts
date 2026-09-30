import { create } from 'zustand'
import type { UIMessage } from 'ai'

const KEY = 'cancel-experience:agent:concierge'
const MEMORY_KEY = 'cancel-experience:memory:concierge'

/** Who a chat belongs to: Home, a cancel page thread, or an in-app offer or pricing table experience. */
export type OwnerKey = 'home' | `cancel:${string}` | `growth:${string}`

export interface Triage {
  objective: 'acquisition' | 'expansion' | 'retention' | 'none'
  object: string
  type?: string | null
  action: string
  target?: string | null
  confidence: number
  summary: string
}

export interface AgentChatRec {
  id: string
  title: string
  owner: OwnerKey
  messages: UIMessage[]
  updatedAt: number
  triage?: Triage
}

interface AgentState {
  chats: Record<string, AgentChatRec>
  /** The open chat for each owner. */
  active: Record<string, string>
  memory: string[]
  briefs: Record<string, string>
  newChat: (owner: OwnerKey) => string
  ensureChat: (owner: OwnerKey) => string
  setActive: (owner: OwnerKey, id: string) => void
  save: (id: string, messages: UIMessage[]) => void
  /** Hand a chat to a new owner, as when Home creates an experience. */
  moveChat: (id: string, owner: OwnerKey) => void
  setTriage: (id: string, triage: Triage) => void
  remember: (fact: string) => void
  forget: (index: number) => void
  setBrief: (owner: OwnerKey, brief: string) => void
}

function newChatId() {
  return `chat_${Math.random().toString(36).slice(2, 10)}`
}

function titleFrom(messages: UIMessage[]): string | null {
  const first = messages.find((m) => m.role === 'user')
  const text = first?.parts.find((p) => p.type === 'text')?.text.trim()
  if (!text) return null
  return text.length > 48 ? `${text.slice(0, 46)}…` : text
}

type Saved = Pick<AgentState, 'chats' | 'active' | 'briefs'>

function load(): Saved & { memory: string[] } {
  const empty = { chats: {}, active: {}, briefs: {} }
  let saved: Saved = empty
  let memory: string[] = []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) saved = { ...empty, ...(JSON.parse(raw) as Partial<Saved>) }
    const mem = localStorage.getItem(MEMORY_KEY)
    if (mem) memory = JSON.parse(mem) as string[]
  } catch {
    /* start clean */
  }
  return { ...saved, memory }
}

export const useAgentStore = create<AgentState>((set, get) => ({
  ...load(),
  newChat: (owner) => {
    const id = newChatId()
    set((s) => ({
      chats: { ...s.chats, [id]: { id, title: 'New chat', owner, messages: [], updatedAt: Date.now() } },
      active: { ...s.active, [owner]: id },
    }))
    return id
  },
  ensureChat: (owner) => {
    const id = get().active[owner]
    if (id && get().chats[id]) return id
    return get().newChat(owner)
  },
  setActive: (owner, id) => set((s) => ({ active: { ...s.active, [owner]: id } })),
  save: (id, messages) =>
    set((s) => {
      const rec = s.chats[id]
      if (!rec) return s
      const title = rec.title === 'New chat' ? (titleFrom(messages) ?? rec.title) : rec.title
      return { chats: { ...s.chats, [id]: { ...rec, messages, title, updatedAt: Date.now() } } }
    }),
  moveChat: (id, owner) =>
    set((s) => {
      const rec = s.chats[id]
      if (!rec) return s
      const active: Record<string, string> = { ...s.active, [owner]: id }
      if (s.active[rec.owner] === id) delete active[rec.owner]
      return { chats: { ...s.chats, [id]: { ...rec, owner } }, active }
    }),
  setTriage: (id, triage) =>
    set((s) => (s.chats[id] ? { chats: { ...s.chats, [id]: { ...s.chats[id], triage } } } : s)),
  remember: (fact) => set((s) => (s.memory.includes(fact) ? s : { memory: [...s.memory, fact].slice(-30) })),
  forget: (index) => set((s) => ({ memory: s.memory.filter((_, i) => i !== index) })),
  setBrief: (owner, brief) => set((s) => ({ briefs: { ...s.briefs, [owner]: brief } })),
}))

useAgentStore.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ chats: s.chats, active: s.active, briefs: s.briefs }))
    localStorage.setItem(MEMORY_KEY, JSON.stringify(s.memory))
  } catch {
    /* storage full or blocked */
  }
})

export function chatsFor(chats: Record<string, AgentChatRec>, owner: OwnerKey): AgentChatRec[] {
  return Object.values(chats)
    .filter((c) => c.owner === owner)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}
