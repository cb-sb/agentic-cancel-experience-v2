import { uid } from './id'
import type { Experience } from '../types/experience'

/** Deep-clone an experience with a fresh id (and optional name). */
export function cloneExperience(
  source: Experience,
  opts: { id?: string; name?: string } = {},
): Experience {
  const copy = structuredClone(source)
  copy.id = opts.id ?? uid('exp')
  copy.name = opts.name ?? `${source.name} (copy)`
  return copy
}

/** Short badge label for canvas chrome (last segment of the id). */
export function experienceBadge(id: string): string {
  const tail = id.split('_').pop() ?? id
  return tail.length > 8 ? tail.slice(-6) : tail
}
