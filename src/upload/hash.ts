import type { TemplateArtifactFile } from './types'

/** Stable checksum of concatenated artifact files. Layout change → new hash. */
export function hashFiles(files: TemplateArtifactFile[]): string {
  const payload = files.map((f) => `${f.path}\0${f.html}\0${f.css ?? ''}`).join('\n')
  let h = 2166136261
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
