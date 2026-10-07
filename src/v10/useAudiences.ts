import { create } from 'zustand'
import { AUDIENCE_LIBRARY, type Audience, type AudienceCondition } from '../types/orchestration'

const KEY = 'cancel-experience:audiences:v10'
const DAY = 86_400_000

export interface AudienceRecord extends Audience {
  updatedAt: number
}

interface AudiencesState {
  items: AudienceRecord[]
}

let n = 0
const newId = () => `aud-${Date.now().toString(36)}-${n++}`

function seed(): AudienceRecord[] {
  const now = Date.now()
  return AUDIENCE_LIBRARY.map((audience, index) => ({
    id: audience.id,
    name: audience.name,
    ruleType: 'TARGETING',
    match: audience.match,
    conditions: audience.conditions,
    updatedAt: now - (index + 1) * 12 * DAY,
  }))
}

function load(): AudiencesState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { items: seed() }
    const parsed = JSON.parse(raw) as { items?: AudienceRecord[] }
    return { items: Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : seed() }
  } catch {
    return { items: seed() }
  }
}

export const useAudiences = create<AudiencesState>(load)

useAudiences.subscribe((state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items: state.items }))
  } catch {
    /* storage full or blocked */
  }
})

export function audienceById(id: string): AudienceRecord | undefined {
  return useAudiences.getState().items.find((item) => item.id === id)
}

export function createAudience(): string {
  const item: AudienceRecord = {
    id: newId(),
    name: 'New audience',
    ruleType: 'TARGETING',
    match: 'AND',
    conditions: [{ id: newId(), property: '', operator: 'is', value: '' }],
    updatedAt: Date.now(),
  }
  useAudiences.setState((state) => ({ items: [item, ...state.items] }))
  return item.id
}

export function updateAudience(id: string, patch: Partial<Omit<AudienceRecord, 'id'>>) {
  useAudiences.setState((state) => ({
    items: state.items.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item)),
  }))
}

export function blankCondition(): AudienceCondition {
  return { id: newId(), property: '', operator: 'is', value: '' }
}
