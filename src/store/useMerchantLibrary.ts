import { create } from 'zustand'
import { uid } from '../lib/id'
import type { TemplateArtifact, TemplateManifest } from '../upload/types'
import { recordFromUpload } from '../library/extract'
import type { MerchantComponent, MerchantTemplate } from '../library/types'

const KEY = 'cancel-experience:merchant-library:v1'

interface MerchantLibraryState {
  templates: MerchantTemplate[]
  saveFromUpload: (artifact: TemplateArtifact, manifest: TemplateManifest, name?: string) => MerchantTemplate
  removeTemplate: (id: string) => void
  getTemplate: (id: string) => MerchantTemplate | undefined
  getComponent: (id: string) => { template: MerchantTemplate; component: MerchantComponent } | undefined
}

function read(): MerchantTemplate[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { templates?: MerchantTemplate[] }
    return Array.isArray(parsed.templates) ? parsed.templates : []
  } catch {
    return []
  }
}

function write(templates: MerchantTemplate[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, templates }))
  } catch {
    /* quota */
  }
}

export const useMerchantLibrary = create<MerchantLibraryState>((set, get) => ({
  templates: typeof localStorage === 'undefined' ? [] : read(),

  saveFromUpload: (artifact, manifest, name) => {
    const incoming = recordFromUpload(artifact, manifest, name)
    const existing = get().templates.find((t) => t.checksum === artifact.checksum)
    const saved: MerchantTemplate = existing
      ? {
          ...incoming,
          id: existing.id,
          savedAt: Date.now(),
          name: name?.trim() || existing.name,
          components: incoming.components.map((c, i) => ({
            ...c,
            id: existing.components[i]?.id ?? c.id ?? uid('cmp'),
          })),
        }
      : incoming
    const templates = existing
      ? get().templates.map((t) => (t.id === existing.id ? saved : t))
      : [saved, ...get().templates]
    write(templates)
    set({ templates })
    return saved
  },

  removeTemplate: (id) => {
    const templates = get().templates.filter((t) => t.id !== id)
    write(templates)
    set({ templates })
  },

  getTemplate: (id) => get().templates.find((t) => t.id === id),

  getComponent: (id) => {
    for (const template of get().templates) {
      const component = template.components.find((c) => c.id === id)
      if (component) return { template, component }
    }
    return undefined
  },
}))
