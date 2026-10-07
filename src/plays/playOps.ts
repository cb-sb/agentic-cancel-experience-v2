import type { Audience } from '../types/orchestration'
import type { CancelPlay, EmptyRow, PlayVariant, SplitBy, SubAudience } from './types'

let n = 0
export const newPlayId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${n++}`

export function variantFor(experienceId: string, weight = 100, subAudienceId?: string): PlayVariant {
  return subAudienceId ? { id: newPlayId('var'), experienceId, weight, subAudienceId } : { id: newPlayId('var'), experienceId, weight }
}

/** Equal shares that add up to exactly 100. */
export function evenWeights(variants: PlayVariant[]): PlayVariant[] {
  if (variants.length === 0) return variants
  const base = Math.floor(100 / variants.length)
  const extra = 100 - base * variants.length
  return variants.map((v, i) => ({ ...v, weight: base + (i < extra ? 1 : 0) }))
}

/** Saves from before sub-audiences held pages: each page with its own audience becomes a sub-audience. */
export function normalizePlay<P extends CancelPlay>(p: P): P {
  const subAudiences: SubAudience[] = [...(p.subAudiences ?? [])]
  const variants = p.variants.map((v) => {
    if (!v.audience) return v
    const { audience, ...rest } = v
    if (p.splitBy !== 'segments' || rest.subAudienceId) return rest
    const sub = { id: newPlayId('sub'), audience }
    subAudiences.push(sub)
    return { ...rest, subAudienceId: sub.id, weight: 100 }
  })
  return { ...p, variants, subAudiences, emptyRows: p.emptyRows ?? [] }
}

/** Fresh ids for a duplicated play's sub-audiences, pages and empty rows. */
export function copySubAudiences(src: CancelPlay): Pick<CancelPlay, 'variants' | 'subAudiences' | 'emptyRows'> {
  const ids = new Map(src.subAudiences.map((x) => [x.id, newPlayId('sub')]))
  const subId = (id: string | null | undefined) => (id ? ids.get(id) : undefined)
  return {
    subAudiences: src.subAudiences.map((x) => ({ ...x, id: ids.get(x.id)! })),
    variants: src.variants.map((v) => ({ ...v, id: newPlayId('var'), ...(v.subAudienceId ? { subAudienceId: subId(v.subAudienceId) } : {}) })),
    emptyRows: src.emptyRows.map((r) => ({ ...r, id: newPlayId('row'), subAudienceId: subId(r.subAudienceId) ?? null })),
  }
}

/** Which test a page or empty row is in. Null: the play's own test, or the fallback when split by sub-audience. */
export function groupOf(p: CancelPlay, row: { subAudienceId?: string | null }): string | null {
  return p.splitBy === 'segments' ? (row.subAudienceId ?? null) : null
}

/** Spread 100% evenly over one test's pages and empty rows. The fallback is always one page. */
export function evenIn<P extends CancelPlay>(p: P, group: string | null): P {
  if (p.splitBy === 'segments' && group === null) return p
  const ids = [
    ...p.variants.filter((v) => groupOf(p, v) === group).map((v) => v.id),
    ...p.emptyRows.filter((r) => r.subAudienceId === group).map((r) => r.id),
  ]
  if (ids.length === 0) return p
  const base = Math.floor(100 / ids.length)
  const extra = 100 - base * ids.length
  const w = new Map(ids.map((id, i) => [id, base + (i < extra ? 1 : 0)]))
  return {
    ...p,
    variants: p.variants.map((v) => (w.has(v.id) ? { ...v, weight: w.get(v.id)! } : v)),
    emptyRows: p.emptyRows.map((r) => (w.has(r.id) ? { ...r, weight: w.get(r.id)! } : r)),
  }
}

export function blankSubAudience(n: number): Audience {
  return { id: newPlayId('aud'), name: `Sub-audience ${n}`, ruleType: 'TARGETING', match: 'AND', conditions: [], savedAudienceId: null }
}

/** A sub-audience whose rules are not picked yet. It matches nobody. */
export function audienceUnset(a: Audience): boolean {
  return !a.targetAll && !a.savedAudienceId && !(a.conditions?.length)
}

export type PlayAction = 'show' | 'test' | 'segments'

/** Where a set of plays lives. Retention's plays and each Growth objective's plays bind the same operations to their own store. */
export interface PlayStore {
  get(id: string): CancelPlay | undefined
  patch(id: string, change: (p: CancelPlay) => CancelPlay): void
  /** After pages leave a play, for stores that track where an experience lives. */
  left?(playId: string, experienceIds: string[]): void
}

export function makePlayOps(store: PlayStore) {
  const { get, patch } = store
  const left = (playId: string, ids: string[]) => {
    if (ids.length) store.left?.(playId, ids)
  }

  /**
   * What the play does with its audience: one page, a test of pages, or sub-audiences.
   * Switching keeps the pages it can. One page keeps the first; sub-audiences take the pages into the first one.
   */
  function setAction(playId: string, action: PlayAction) {
    const before = get(playId)?.variants.map((v) => v.experienceId) ?? []
    patch(playId, (p) => {
      const pages: PlayVariant[] = []
      for (const v of p.variants) if (!pages.some((x) => x.experienceId === v.experienceId)) pages.push(v)
      const flat = pages.map(({ subAudienceId: _, ...v }) => v)
      if (action === 'show') {
        return { ...p, splitBy: 'percent', subAudiences: [], emptyRows: [], variants: flat.slice(0, 1).map((v) => ({ ...v, weight: 100 })) }
      }
      if (action === 'test') {
        const rows: EmptyRow[] = p.splitBy === 'percent' ? p.emptyRows : []
        const missing = Math.max(0, 2 - flat.length - rows.length)
        const emptyRows = [...rows, ...Array.from({ length: missing }, () => ({ id: newPlayId('row'), subAudienceId: null, weight: 0 }))]
        return evenIn({ ...p, splitBy: 'percent', subAudiences: [], emptyRows, variants: flat }, null)
      }
      if (p.splitBy === 'segments') return p
      const first: SubAudience = { id: newPlayId('sub'), audience: blankSubAudience(1) }
      const next: CancelPlay = {
        ...p,
        splitBy: 'segments',
        subAudiences: [first],
        variants: flat.map((v) => ({ ...v, subAudienceId: first.id })),
        emptyRows: p.emptyRows.map((r) => ({ ...r, subAudienceId: first.id })),
      }
      return evenIn(next, first.id)
    })
    const after = new Set(get(playId)?.variants.map((v) => v.experienceId) ?? [])
    left(playId, before.filter((id) => !after.has(id)))
  }

  /** Older callers: percent becomes one page or a test, depending on how many pages there are. */
  function setSplitBy(id: string, splitBy: SplitBy) {
    const play = get(id)
    if (!play) return
    setAction(id, splitBy === 'segments' ? 'segments' : play.variants.length > 1 ? 'test' : 'show')
  }

  function addSubAudience(playId: string, audience?: Audience): string {
    const id = newPlayId('sub')
    patch(playId, (p) => ({ ...p, subAudiences: [...p.subAudiences, { id, audience: audience ?? blankSubAudience(p.subAudiences.length + 1) }] }))
    return id
  }

  function setSubAudience(playId: string, subId: string, audience: Audience) {
    patch(playId, (p) => ({ ...p, subAudiences: p.subAudiences.map((x) => (x.id === subId ? { ...x, audience } : x)) }))
  }

  /** Its pages leave the play with it. */
  function removeSubAudience(playId: string, subId: string) {
    const gone = get(playId)?.variants.filter((v) => v.subAudienceId === subId).map((v) => v.experienceId) ?? []
    patch(playId, (p) => ({
      ...p,
      subAudiences: p.subAudiences.filter((x) => x.id !== subId),
      variants: p.variants.filter((v) => v.subAudienceId !== subId),
      emptyRows: p.emptyRows.filter((r) => r.subAudienceId !== subId),
    }))
    const still = new Set(get(playId)?.variants.map((v) => v.experienceId) ?? [])
    left(playId, gone.filter((id) => !still.has(id)))
  }

  /** One more row in a test: an empty one, or straight to a page. Null group: the play's own test. */
  function addRow(playId: string, group: string | null, experienceId?: string) {
    patch(playId, (p) => {
      if (experienceId) {
        if (p.variants.some((v) => groupOf(p, v) === group && v.experienceId === experienceId)) return p
        return evenIn({ ...p, variants: [...p.variants, variantFor(experienceId, 0, group ?? undefined)] }, group)
      }
      return evenIn({ ...p, emptyRows: [...p.emptyRows, { id: newPlayId('row'), subAudienceId: group, weight: 0 }] }, group)
    })
  }

  /**
   * Picks the page for a row. An empty row becomes a page with its weight. With no row,
   * it fills the group: the only page of one-page plays, or the fallback.
   * False when that test already has the page.
   */
  function setRowPage(playId: string, group: string | null, rowId: string | null, experienceId: string): boolean {
    const play = get(playId)
    if (!play) return false
    const clash = play.variants.some((v) => groupOf(play, v) === group && v.experienceId === experienceId && v.id !== rowId)
    if (clash) return false
    const replaced = rowId ? play.variants.find((v) => v.id === rowId)?.experienceId : play.variants.filter((v) => groupOf(play, v) === group).map((v) => v.experienceId)[0]
    patch(playId, (p) => {
      const empty = p.emptyRows.find((r) => r.id === rowId)
      if (empty) {
        return {
          ...p,
          emptyRows: p.emptyRows.filter((r) => r.id !== rowId),
          variants: [...p.variants, variantFor(experienceId, empty.weight, group ?? undefined)],
        }
      }
      if (rowId) return { ...p, variants: p.variants.map((v) => (v.id === rowId ? { ...v, experienceId } : v)) }
      const rest = p.variants.filter((v) => groupOf(p, v) !== group)
      return { ...p, variants: [...rest, variantFor(experienceId, 100, group ?? undefined)] }
    })
    if (replaced && replaced !== experienceId && !get(playId)?.variants.some((v) => v.experienceId === replaced)) left(playId, [replaced])
    return true
  }

  /** Moves one row's share. With two rows in the test, the other takes the rest. */
  function setRowWeight(playId: string, rowId: string, weight: number) {
    const w = Math.max(0, Math.min(100, Math.round(weight)))
    patch(playId, (p) => {
      const row = p.variants.find((v) => v.id === rowId) ?? p.emptyRows.find((r) => r.id === rowId)
      if (!row) return p
      const group = groupOf(p, row)
      const ids = [...p.variants.filter((v) => groupOf(p, v) === group).map((v) => v.id), ...p.emptyRows.filter((r) => r.subAudienceId === group).map((r) => r.id)]
      const other = ids.length === 2 ? ids.find((id) => id !== rowId) : undefined
      const next = (id: string, cur: number) => (id === rowId ? w : id === other ? 100 - w : cur)
      return {
        ...p,
        variants: p.variants.map((v) => ({ ...v, weight: next(v.id, v.weight) })),
        emptyRows: p.emptyRows.map((r) => ({ ...r, weight: next(r.id, r.weight) })),
      }
    })
  }

  function removeRow(playId: string, rowId: string) {
    const gone = get(playId)?.variants.find((v) => v.id === rowId)?.experienceId
    patch(playId, (p) => {
      const row = p.variants.find((v) => v.id === rowId) ?? p.emptyRows.find((r) => r.id === rowId)
      if (!row) return p
      const group = groupOf(p, row)
      return evenIn({ ...p, variants: p.variants.filter((v) => v.id !== rowId), emptyRows: p.emptyRows.filter((r) => r.id !== rowId) }, group)
    })
    if (gone && !get(playId)?.variants.some((v) => v.experienceId === gone)) left(playId, [gone])
  }

  function setVariant(playId: string, variantId: string, change: Partial<Omit<PlayVariant, 'id'>>) {
    patch(playId, (p) => ({ ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, ...change } : v)) }))
  }

  function evenWeightsIn(playId: string, group: string | null) {
    patch(playId, (p) => evenIn(p, group))
  }

  /**
   * False when the experience is already in that play. Split by sub-audience, it fills
   * the fallback first, then joins the last sub-audience's test.
   */
  function addToPlay(playId: string, experienceId: string, at?: number): boolean {
    const play = get(playId)
    if (!play || play.variants.some((v) => v.experienceId === experienceId)) return false
    patch(playId, (p) => {
      if (p.splitBy === 'segments') {
        const hasFallback = p.variants.some((v) => !v.subAudienceId)
        const last = p.subAudiences[p.subAudiences.length - 1]
        const group = hasFallback && last ? last.id : null
        if (group === null && hasFallback) return p
        return evenIn({ ...p, variants: [...p.variants, variantFor(experienceId, group ? 0 : 100, group ?? undefined)] }, group)
      }
      const next = [...p.variants]
      next.splice(at ?? next.length, 0, variantFor(experienceId))
      return evenIn({ ...p, variants: next }, null)
    })
    return true
  }

  function removeFromPlay(playId: string, variantId: string) {
    removeRow(playId, variantId)
  }

  /** Moves a variant to another play. False when the target already has that experience. */
  function moveToPlay(fromPlayId: string, variantId: string, toPlayId: string): boolean {
    if (fromPlayId === toPlayId) return false
    const v = get(fromPlayId)?.variants.find((x) => x.id === variantId)
    if (!v || !addToPlay(toPlayId, v.experienceId)) return false
    removeFromPlay(fromPlayId, variantId)
    return true
  }

  function reorderVariant(playId: string, variantId: string, toIndex: number) {
    patch(playId, (p) => {
      const next = [...p.variants]
      const from = next.findIndex((v) => v.id === variantId)
      if (from < 0) return p
      const [moved] = next.splice(from, 1)
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved)
      return { ...p, variants: next }
    })
  }

  /** Points one play's variant at a different experience (after "Make a separate copy"). */
  function swapExperience(playId: string, oldExperienceId: string, newExperienceId: string) {
    patch(playId, (p) => ({
      ...p,
      variants: p.variants.map((v) => (v.experienceId === oldExperienceId ? { ...v, experienceId: newExperienceId } : v)),
    }))
  }

  function updatePlay(id: string, change: Partial<Omit<CancelPlay, 'id'>>) {
    patch(id, (p) => ({ ...p, ...change }))
  }

  function setPlayLive(id: string, live: boolean) {
    patch(id, (p) => ({ ...p, status: live ? 'live' : 'draft', publishedAt: live ? Date.now() : p.publishedAt }))
  }

  return {
    setAction,
    setSplitBy,
    addSubAudience,
    setSubAudience,
    removeSubAudience,
    addRow,
    setRowPage,
    setRowWeight,
    removeRow,
    setVariant,
    evenWeightsIn,
    addToPlay,
    removeFromPlay,
    moveToPlay,
    reorderVariant,
    swapExperience,
    updatePlay,
    setPlayLive,
  }
}

export type PlayOps = ReturnType<typeof makePlayOps>
