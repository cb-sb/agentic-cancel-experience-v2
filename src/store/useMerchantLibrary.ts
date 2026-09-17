import { create } from 'zustand'
import { uid } from '../lib/id'
import { hashChrome } from '../upload/hash'
import type { TemplateArtifact, TemplateManifest } from '../upload/types'
import { extractComponents, recordFromUpload } from '../library/extract'
import type { MerchantComponent, MerchantTemplate } from '../library/types'

const KEY = 'cancel-experience:merchant-library:v2'
const LEGACY_KEY = 'cancel-experience:merchant-library:v1'

interface LibraryDoc {
  templates: MerchantTemplate[]
  components: MerchantComponent[]
}

interface MerchantLibraryState {
  templates: MerchantTemplate[]
  components: MerchantComponent[]
  saveFromUpload: (artifact: TemplateArtifact, manifest: TemplateManifest, name?: string) => MerchantTemplate
  removeTemplate: (id: string) => void
  getTemplate: (id: string) => MerchantTemplate | undefined
  getComponent: (id: string) => MerchantComponent | undefined
}

function emptyDoc(): LibraryDoc {
  return { templates: [], components: [] }
}

function migrateV1(parsed: { templates?: MerchantTemplate[] }): LibraryDoc {
  const templates: MerchantTemplate[] = []
  const components: MerchantComponent[] = []
  for (const raw of parsed.templates ?? []) {
    const ids: string[] = raw.componentIds?.length ? [...raw.componentIds] : []
    if (!raw.componentIds?.length) {
      for (const c of raw.components ?? []) {
        const contentHash = c.contentHash || hashChrome(c.kind, c.html, c.css)
        const existing = components.find((row) => row.contentHash === contentHash)
        if (existing) {
          ids.push(existing.id)
          continue
        }
        const row: MerchantComponent = {
          ...c,
          id: c.id || uid('cmp'),
          contentHash,
        }
        components.push(row)
        ids.push(row.id)
      }
    } else {
      for (const c of raw.components ?? []) {
        if (!components.some((row) => row.id === c.id)) {
          components.push({
            ...c,
            contentHash: c.contentHash || hashChrome(c.kind, c.html, c.css),
          })
        }
      }
    }
    templates.push({ ...raw, componentIds: ids, components: undefined })
  }
  return { templates, components }
}

function read(): LibraryDoc {
  try {
    const v2 = localStorage.getItem(KEY)
    if (v2) {
      const parsed = JSON.parse(v2) as Partial<LibraryDoc>
      return {
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        components: Array.isArray(parsed.components) ? parsed.components : [],
      }
    }
    const v1 = localStorage.getItem(LEGACY_KEY)
    if (v1) {
      const doc = migrateV1(JSON.parse(v1) as { templates?: MerchantTemplate[] })
      write(doc)
      return doc
    }
  } catch {
    /* corrupt */
  }
  return emptyDoc()
}

function write(doc: LibraryDoc) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 2, templates: doc.templates, components: doc.components }))
  } catch {
    /* quota */
  }
}

function upsertComponents(
  catalog: MerchantComponent[],
  incoming: MerchantComponent[],
): { catalog: MerchantComponent[]; ids: string[] } {
  const next = [...catalog]
  const ids: string[] = []
  for (const row of incoming) {
    const hash = row.contentHash || hashChrome(row.kind, row.html, row.css)
    const existing = next.find((c) => c.contentHash === hash)
    if (existing) {
      ids.push(existing.id)
      continue
    }
    const saved: MerchantComponent = { ...row, id: row.id || uid('cmp'), contentHash: hash }
    next.unshift(saved)
    ids.push(saved.id)
  }
  return { catalog: next, ids }
}

const initial = typeof localStorage === 'undefined' ? emptyDoc() : read()

export const useMerchantLibrary = create<MerchantLibraryState>((set, get) => ({
  templates: initial.templates,
  components: initial.components,

  saveFromUpload: (artifact, manifest, name) => {
    const extracted = extractComponents(artifact, { ...manifest, confirmed: true })
    const { catalog, ids } = upsertComponents(get().components, extracted)
    const incoming = recordFromUpload(artifact, manifest, name, ids)
    const existing = get().templates.find((t) => t.checksum === artifact.checksum)
    const saved: MerchantTemplate = existing
      ? {
          ...incoming,
          id: existing.id,
          savedAt: Date.now(),
          name: name?.trim() || existing.name,
          componentIds: ids,
        }
      : incoming
    const templates = existing
      ? get().templates.map((t) => (t.id === existing.id ? saved : t))
      : [saved, ...get().templates]
    const doc = { templates, components: catalog }
    write(doc)
    set(doc)
    return saved
  },

  removeTemplate: (id) => {
    const templates = get().templates.filter((t) => t.id !== id)
    const doc = { templates, components: get().components }
    write(doc)
    set(doc)
  },

  getTemplate: (id) => get().templates.find((t) => t.id === id),

  getComponent: (id) => {
    const fromCatalog = get().components.find((c) => c.id === id)
    if (fromCatalog) return fromCatalog
    for (const template of get().templates) {
      const nested = template.components?.find((c) => c.id === id)
      if (nested) return nested
    }
    return undefined
  },
}))
