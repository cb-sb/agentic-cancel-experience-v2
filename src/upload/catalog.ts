import { CB_KINDS, parseCbKind } from './contract'
import type { ContractIssue, TemplateArtifact } from './types'

export const CATALOG_KIT = 'catalog'

export const CATALOG_REJECT_MESSAGE =
  'This is the starter catalog. Export the experience your LLM composed — do not upload this catalog zip.'

export function catalogRejectIssue(): ContractIssue {
  return { level: 'error', message: CATALOG_REJECT_MESSAGE }
}

export function isCatalogHtml(html: string): boolean {
  return /data-cb-kit\s*=\s*["']catalog["']/i.test(html)
}

/** Fail-closed: the generic pack is primitives, not a journey. */
export function isCatalogPack(artifact: TemplateArtifact): boolean {
  const htmlFiles = artifact.files.filter((f) => /\.html?$/i.test(f.path) || !f.path.includes('.'))
  if (htmlFiles.length === 0) return false
  if (htmlFiles.some((f) => /(^|\/)primitives\//.test(f.path))) return true
  if (htmlFiles.some((f) => isCatalogHtml(f.html))) return true

  const kinds = new Set<string>()
  let hasNext = false
  for (const f of htmlFiles) {
    if (/data-cb-next/.test(f.html)) hasNext = true
    for (const match of f.html.matchAll(/data-cb-kind\s*=\s*["']([^"']+)["']/gi)) {
      kinds.add(parseCbKind(match[1]) ?? match[1])
    }
  }
  return !hasNext && CB_KINDS.every((kind) => kinds.has(kind))
}
