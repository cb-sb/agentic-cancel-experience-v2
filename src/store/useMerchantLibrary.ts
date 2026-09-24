import { create } from 'zustand'
import { uid } from '../lib/id'
import { hashChrome } from '../upload/hash'
import type { TemplateArtifact, TemplateManifest } from '../upload/types'
import { extractComponents, recordFromUpload } from '../library/extract'
import {
  identifyOffers,
  offerHash,
  offerIdsIn,
  offerName,
  paintOffer,
  upsertSavedJourney,
  type OfferWording,
} from '../library/offers'
import { identifyCards, paintCard } from '../library/cards'
import type { JourneyFile } from '../journey/types'
import type { MerchantComponent, MerchantTemplate, SavedJourney, SharedCard, SharedOffer } from '../library/types'

const KEY = 'cancel-experience:merchant-library:v2'
const LEGACY_KEY = 'cancel-experience:merchant-library:v1'

interface LibraryDoc {
  templates: MerchantTemplate[]
  components: MerchantComponent[]
  offers: SharedOffer[]
  cards: SharedCard[]
  journeys: SavedJourney[]
}

interface MerchantLibraryState {
  templates: MerchantTemplate[]
  components: MerchantComponent[]
  offers: SharedOffer[]
  cards: SharedCard[]
  journeys: SavedJourney[]
  saveFromUpload: (artifact: TemplateArtifact, manifest: TemplateManifest, name?: string) => MerchantTemplate
  removeTemplate: (id: string) => void
  getTemplate: (id: string) => MerchantTemplate | undefined
  getComponent: (id: string) => MerchantComponent | undefined
  /** Pull this journey's offers into the library and remember the journey. */
  syncJourney: (file: JourneyFile) => JourneyFile
  /** Change a shared offer. Every saved journey that links to it is updated. */
  updateOffer: (id: string, wording: OfferWording) => void
  /** A separate offer with the same wording, so a variant does not overwrite the original. */
  duplicateOffer: (id: string) => SharedOffer | undefined
}

function emptyDoc(): LibraryDoc {
  return { templates: [], components: [], offers: [], cards: [], journeys: [] }
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
  return { templates, components, offers: [], cards: [], journeys: [] }
}

function read(): LibraryDoc {
  try {
    const v2 = localStorage.getItem(KEY)
    if (v2) {
      const parsed = JSON.parse(v2) as Partial<LibraryDoc>
      return {
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        components: Array.isArray(parsed.components) ? parsed.components : [],
        offers: Array.isArray(parsed.offers) ? parsed.offers : [],
        cards: Array.isArray(parsed.cards) ? parsed.cards : [],
        journeys: Array.isArray(parsed.journeys) ? parsed.journeys : [],
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
    localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 2,
        templates: doc.templates,
        components: doc.components,
        offers: doc.offers,
        cards: doc.cards,
        journeys: doc.journeys,
      }),
    )
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
    const saved: MerchantComponent = {
      ...row,
      id: row.id || uid('cmp'),
      contentHash: hash,
      savedAt: row.savedAt ?? Date.now(),
    }
    next.unshift(saved)
    ids.push(saved.id)
  }
  return { catalog: next, ids }
}

const initial = typeof localStorage === 'undefined' ? emptyDoc() : read()

function persist(doc: LibraryDoc) {
  write(doc)
  return doc
}

export const useMerchantLibrary = create<MerchantLibraryState>((set, get) => ({
  templates: initial.templates,
  components: initial.components,
  offers: initial.offers,
  cards: initial.cards,
  journeys: initial.journeys,

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
    const doc = persist({
      templates,
      components: catalog,
      offers: get().offers,
      cards: get().cards,
      journeys: get().journeys,
    })
    set(doc)
    return saved
  },

  removeTemplate: (id) => {
    const templates = get().templates.filter((t) => t.id !== id)
    const doc = persist({
      templates,
      components: get().components,
      offers: get().offers,
      cards: get().cards,
      journeys: get().journeys,
    })
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

  syncJourney: (file) => {
    if (file.steps.length === 0) return file
    const identified = identifyOffers(file, get().offers)
    const carded = identifyCards(identified.file, get().cards)
    let painted = identified.offers.reduce((acc, offer) => paintOffer(acc, offer), carded.file)
    painted = carded.cards.reduce((acc, card) => paintCard(acc, card), painted)
    const journeys = upsertSavedJourney(get().journeys, painted).map((journey) => {
      if (journey.id === painted.libraryId) return journey
      const next = carded.cards.reduce(
        (acc, card) => paintCard(acc, card),
        paintOffersOn(journey.file, identified.offers),
      )
      return { ...journey, file: next, offerIds: offerIdsIn(next) }
    })
    const doc = persist({
      templates: get().templates,
      components: get().components,
      offers: identified.offers,
      cards: carded.cards,
      journeys,
    })
    set(doc)
    return painted
  },

  updateOffer: (id, wording) => {
    const current = get().offers.find((o) => o.id === id)
    if (!current) return
    const next: SharedOffer = {
      ...current,
      ...wording,
      name: offerName(wording.title, wording.offer),
      contentHash: offerHash(wording),
      savedAt: Date.now(),
    }
    const offers = get().offers.map((o) => (o.id === id ? next : o))
    const journeys = get().journeys.map((journey) => ({
      ...journey,
      file: paintOffer(journey.file, next),
      offerIds: offerIdsIn(paintOffer(journey.file, next)),
    }))
    const doc = persist({
      templates: get().templates,
      components: get().components,
      offers,
      cards: get().cards,
      journeys,
    })
    set(doc)
  },

  duplicateOffer: (id) => {
    const src = get().offers.find((o) => o.id === id)
    if (!src) return undefined
    const copy: SharedOffer = {
      ...src,
      id: uid('offer'),
      name: `${src.name} copy`,
      savedAt: Date.now(),
    }
    const doc = persist({
      templates: get().templates,
      components: get().components,
      offers: [copy, ...get().offers],
      cards: get().cards,
      journeys: get().journeys,
    })
    set(doc)
    return copy
  },
}))

function paintOffersOn(file: JourneyFile, offers: SharedOffer[]): JourneyFile {
  return offers.reduce((acc, offer) => paintOffer(acc, offer), file)
}
