let counter = 0

/** Small stable-ish id generator for prototype entities. */
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}
