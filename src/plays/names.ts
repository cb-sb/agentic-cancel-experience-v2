const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

export function nameTaken(name: string, taken: string[]): boolean {
  const n = norm(name)
  return taken.some((t) => norm(t) === n)
}

/** `base`, or `base 2`, `base 3`… whichever is free. */
export function uniqueName(base: string, taken: string[]): string {
  const clean = base.trim().replace(/\s+/g, ' ') || 'Untitled'
  if (!nameTaken(clean, taken)) return clean
  const stem = clean.replace(/\s+\d+$/, '')
  for (let i = 2; i < 500; i++) {
    const next = `${stem} ${i}`
    if (!nameTaken(next, taken)) return next
  }
  return `${stem} ${Date.now()}`
}

/** Null when the name can be used, otherwise what to tell the merchant. */
export function nameProblem(name: string, taken: string[], kind: 'play' | 'experience'): string | null {
  if (!name.trim()) return 'Give it a name'
  if (nameTaken(name, taken)) return `Another ${kind} is already called this`
  return null
}
