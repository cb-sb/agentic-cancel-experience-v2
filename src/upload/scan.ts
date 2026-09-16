import type { JourneyStepKind } from '../journey/types'
import { defaultSurveyOptions } from '../lib/factories'
import { uid } from '../lib/id'
import { CB, isCbSlotName, parseCbKind } from './contract'
import { hashFiles } from './hash'
import { readZip } from './pack'
import type {
  ContractIssue,
  ManifestField,
  ManifestSlot,
  ManifestSlotType,
  ManifestStep,
  TemplateArtifact,
  TemplateArtifactFile,
  TemplateManifest,
} from './types'
import { DEFAULT_SUBSCRIBER_CONTEXT, isCbAction } from './types'

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function slug(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return s || fallback
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function lineInSource(html: string, attr: string, value: string): number | undefined {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`${attr}\\s*=\\s*["']${escaped}["']`)
  const m = html.match(re)
  if (m?.index == null) return undefined
  return html.slice(0, m.index).split('\n').length
}

function issue(
  partial: Omit<ContractIssue, 'level'> & { level?: ContractIssue['level'] },
): ContractIssue {
  return { level: 'error', ...partial }
}

function slotTypeFrom(el: Element): ManifestSlotType | null {
  const raw = el.getAttribute(CB.slot)
  if (raw === 'offer' || raw === 'survey') return raw
  if (raw === 'la_stats' || raw === 'media') return 'field'
  if (el.hasAttribute(CB.field)) return 'field'
  if (el.hasAttribute(CB.action)) return 'action'
  return null
}

function collectSlots(root: Element, warnings: string[]): ManifestSlot[] {
  const slots: ManifestSlot[] = []
  const seen = new Set<string>()

  root.querySelectorAll(`[${CB.slot}], [${CB.field}], [${CB.action}]`).forEach((el, i) => {
    const type = slotTypeFrom(el)
    if (!type) return
    const field = el.getAttribute(CB.field)
    const action = el.getAttribute(CB.action)
    const slotName = el.getAttribute(CB.slot)
    const id = field || (action ? `action_${action}` : null) || slotName || `slot_${i}`
    if (seen.has(`${type}:${id}`)) return
    seen.add(`${type}:${id}`)
    const slot: ManifestSlot = { id, type }
    if (type === 'action' && action) {
      if (isCbAction(action)) slot.bind = action
      else warnings.push(`Unknown action "${action}" on ${id}`)
    }
    if (type === 'field' && field) slot.bind = field
    if (type === 'offer') slot.bind = 'discount'
    if (type === 'survey') slot.bind = 'default'
    if (slotName && !isCbSlotName(slotName) && type !== 'field' && type !== 'action') {
      warnings.push(`Unknown ${CB.slot}="${slotName}" on ${id}`)
    }
    slots.push(slot)
  })
  return slots
}

function collectFields(root: Element): ManifestField[] {
  const fields: ManifestField[] = []
  const seen = new Set<string>()
  root.querySelectorAll(`[${CB.field}]`).forEach((el) => {
    const name = el.getAttribute(CB.field)
    if (!name || seen.has(name)) return
    seen.add(name)
    fields.push({
      name,
      sample: textOf(el) || DEFAULT_SUBSCRIBER_CONTEXT[name],
    })
  })
  return fields
}

function scanMarkedStep(
  root: Element,
  file: string,
  source: string,
  fallbackId: string,
  warnings: string[],
  issues: ContractIssue[],
): ManifestStep | null {
  const attrId = root.getAttribute(CB.step)
  const id = slug(attrId || fallbackId, fallbackId)
  const line = attrId ? lineInSource(source, CB.step, attrId) : undefined
  const rawKind = root.getAttribute(CB.kind)
  const kind = parseCbKind(rawKind)

  if (!rawKind) {
    issues.push(
      issue({
        file,
        line,
        stepId: id,
        message: `Step "${id}" has no ${CB.kind}. Mark the Growth primitive — do not leave it for Copilot to guess.`,
      }),
    )
    return null
  }
  if (!kind) {
    issues.push(
      issue({
        file,
        line,
        stepId: id,
        message: `Step "${id}" has unknown ${CB.kind}="${rawKind}".`,
      }),
    )
    return null
  }

  return {
    id,
    kind: kind as JourneyStepKind,
    file,
    line,
    slots: collectSlots(root, warnings),
    fields: collectFields(root),
  }
}

function scanHtmlFile(
  file: TemplateArtifactFile,
  warnings: string[],
  issues: ContractIssue[],
): ManifestStep[] {
  const doc = parseHtml(file.html)
  const marked = [...doc.querySelectorAll(`[${CB.step}]`)]
  if (marked.length === 0) {
    issues.push(
      issue({
        file: file.path,
        message: `${file.path} has no ${CB.step}. Start from the starter kit, or mark each screen.`,
      }),
    )
    return []
  }
  return marked
    .map((el, i) => scanMarkedStep(el, file.path, file.html, `step_${i + 1}`, warnings, issues))
    .filter((s): s is ManifestStep => s != null)
}

function orderZipSteps(steps: ManifestStep[], files: TemplateArtifactFile[]): ManifestStep[] {
  if (steps.length <= 1) return steps
  const byFile = new Map(steps.map((s) => [s.file ?? '', s]))
  const nextOf = new Map<string, string>()
  for (const f of files) {
    const doc = parseHtml(f.html)
    const link = doc.querySelector(`[${CB.next}], [${CB.action}="continue"]`)
    const next = link?.getAttribute(CB.next) || link?.getAttribute('href')
    if (next && !next.startsWith('#') && !next.startsWith('http')) {
      nextOf.set(f.path, next.split(/[?#]/)[0] ?? next)
    }
  }
  const start = files.find((f) => /index|value|start/i.test(f.path))?.path ?? files[0]?.path
  if (!start) return steps
  const ordered: ManifestStep[] = []
  const seen = new Set<string>()
  let cur: string | undefined = start
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const step = byFile.get(cur)
    if (step) ordered.push(step)
    cur = nextOf.get(cur)
  }
  for (const s of steps) {
    if (!ordered.includes(s)) ordered.push(s)
  }
  return ordered.length ? ordered : steps
}

export function scanArtifact(artifact: TemplateArtifact): TemplateManifest {
  const warnings: string[] = []
  const issues: ContractIssue[] = []
  const htmlFiles = artifact.files.filter((f) => /\.html?$/i.test(f.path) || !f.path.includes('.'))
  let steps: ManifestStep[] = []

  if (htmlFiles.length === 1) {
    steps = scanHtmlFile(htmlFiles[0], warnings, issues)
  } else {
    const marked: ManifestStep[] = []
    for (const f of htmlFiles) {
      marked.push(...scanHtmlFile(f, warnings, issues))
    }
    steps = orderZipSteps(marked, htmlFiles)
  }

  const ids = new Set<string>()
  for (const s of steps) {
    let id = s.id
    let n = 2
    while (ids.has(id)) {
      id = `${s.id}_${n}`
      n += 1
    }
    s.id = id
    ids.add(id)
  }

  const reasons = defaultSurveyOptions().map((o) => ({ id: o.code ?? o.id, label: o.label }))
  const ctx = { ...DEFAULT_SUBSCRIBER_CONTEXT }
  for (const s of steps) {
    for (const f of s.fields) {
      if (f.sample) ctx[f.name] = f.sample
    }
  }

  return {
    steps,
    warnings,
    issues,
    confirmed: false,
    subscriberContext: ctx,
    surveyReasons: reasons,
  }
}

function isHtmlFile(file: File): boolean {
  return /\.html?$/i.test(file.name) || file.type === 'text/html'
}

function isCssFile(file: File): boolean {
  return /\.css$/i.test(file.name) || file.type === 'text/css'
}

function isZipFile(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'
}

function skipPath(path: string): boolean {
  const base = path.split('/').pop() ?? path
  return !base || base.startsWith('.') || path.includes('__MACOSX')
}

async function entriesToFiles(entries: { path: string; text: string }[]): Promise<TemplateArtifactFile[]> {
  const css = entries.filter((e) => /\.css$/i.test(e.path)).map((e) => e.text).join('\n')
  const htmls = entries.filter((e) => /\.html?$/i.test(e.path))
  if (htmls.length === 0 && css) {
    return [{ path: 'untitled.html', html: `<!doctype html><html><body></body></html>`, css }]
  }
  return htmls.map((h) => ({
    path: h.path.split('/').pop() ?? h.path,
    html: h.text,
    css: css || undefined,
  }))
}

export async function filesToArtifact(input: File[]): Promise<TemplateArtifact> {
  if (input.length === 0) throw new Error('Drop an HTML file or a zip of static pages.')
  const files: { path: string; text: string }[] = []

  if (input.length === 1 && isZipFile(input[0])) {
    const buf = new Uint8Array(await input[0].arrayBuffer())
    const entries = await readZip(buf)
    const decoder = new TextDecoder()
    for (const e of entries) {
      if (skipPath(e.path)) continue
      if (!/\.(html?|css)$/i.test(e.path)) continue
      files.push({ path: e.path, text: decoder.decode(e.bytes) })
    }
  } else {
    for (const f of input) {
      if (isZipFile(f)) {
        const nested = await filesToArtifact([f])
        return nested
      }
      if (isHtmlFile(f) || isCssFile(f)) {
        files.push({ path: f.name, text: await f.text() })
      }
    }
  }

  const artifactFiles = await entriesToFiles(files)
  if (artifactFiles.length === 0) {
    throw new Error('No HTML pages found. Upload .html or a zip of static pages.')
  }
  return {
    id: uid('art'),
    checksum: hashFiles(artifactFiles),
    version: 1,
    files: artifactFiles,
  }
}

export function bumpArtifactVersion(prev: TemplateArtifact | undefined, next: TemplateArtifact): TemplateArtifact {
  if (!prev) return next
  return { ...next, version: prev.checksum === next.checksum ? prev.version : prev.version + 1 }
}
