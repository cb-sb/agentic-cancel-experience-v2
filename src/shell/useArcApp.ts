import { create } from 'zustand'

export type ArcAppId = 'desk' | 'billing' | 'payments' | 'growth' | 'catalog' | 'agents' | 'setup' | 'logs'

export const ARC_APPS: { id: ArcAppId; label: string }[] = [
  { id: 'desk', label: 'Desk' },
  { id: 'billing', label: 'Billing' },
  { id: 'payments', label: 'Payments' },
  { id: 'growth', label: 'Growth' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'agents', label: 'Agents' },
  { id: 'setup', label: 'Setup' },
  { id: 'logs', label: 'Logs' },
]

export const useArcApp = create<{ app: ArcAppId; setApp: (app: ArcAppId) => void }>((set) => ({
  app: 'growth',
  setApp: (app) => set({ app }),
}))
