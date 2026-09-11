import type { JourneyStepKind } from '../journey/types'
import { defaultSurveyOptions } from '../lib/factories'
import { uid } from '../lib/id'
import { CB, CB_KIND_HINTS, type CbKindHint } from './contract'
import { hashFiles } from './hash'
import { readZip } from './pack'
import type {
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

function mapKind(raw: string | null, guessed: JourneyStepKind, warnings: string[], where: string): JourneyStepKind {
  if (!raw) return guessed
  if (raw === 'outcome') return 'outcome_cancelled'
  if (raw === 'outcome_saved' || raw === 'outcome_cancelled') return raw
  if ((CB_KIND_HINTS as readonly string[]).includes(raw)) {
    return raw as Exclude<CbKindHint, 'outcome'>
  }
  warnings.push(`${where}: unknown data-cb-kind "${raw}", using ${guessed}`)
  return guessed
}

function guessKind(root: Element): { kind: JourneyStepKind; guessed: boolean } {
  const kindAttr = root.getAttribute(CB.kind)
  if (kindAttr) return { kind: mapKind(kindAttr, 'survey', [], ''), guessed: false }

  const actions = [...root.querySelectorAll(`[${CB.action}]`)].map((el) => el.getAttribute(CB.action) ?? '')
  if (root.querySelector(`[${CB.slot}="survey"]`) || root.querySelector('input[type="radio"]')) {
    return { kind: 'survey', guessed: true }
  }
  if (root.querySelector(`[${CB.slot}="offer"]`) || actions.includes('accept_offer') || actions.includes('decline_offer')) {
    return { kind: 'offer', guessed: true }
  }
  if (actions.includes('cancel') && actions.includes('keep')) return { kind: 'confirmation', guessed: true }
  if (root.querySelector(`[${CB.field}]`) || root.querySelector(`[${CB.slot}="la_stats"]`)) {
    return { kind: 'loss_aversion', guessed: true }
  }
  const copy = textOf(root).toLowerCase()
  if (/\bcancel\b/.test(copy) && /\bkeep\b/.test(copy)) return { kind: 'confirmation', guessed: true }
  if (/\bclaim\b|\baccept\b|\b50%|\bpause\b/.test(copy)) return { kind: 'offer', guessed: true }
  if (root.querySelectorAll('h1, h2, section').length > 0 && /why|leaving|reason/.test(copy)) {
    return { kind: 'survey', guessed: true }
  }
  return { kind: 'loss_aversion', guessed: true }
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
    const id =
      field ||
      (action ? `action_${action}` : null) ||
      slotName ||
      `slot_${i}`
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

function scanRoot(root: Element, file: string, fallbackId: string, warnings: string[]): ManifestStep {
  const attrId = root.getAttribute(CB.step)
  const heading = textOf(root.querySelector('h1, h2'))
  const id = slug(attrId || heading || fallbackId, fallbackId)
  const { kind, guessed } = guessKind(root)
  const resolved = mapKind(root.getAttribute(CB.kind), kind, warnings, id)
  if (guessed && !root.getAttribute(CB.kind)) {
    warnings.push(`Step "${id}" had no data-cb-kind; guessed ${resolved}`)
  }
  return {
    id,
    kind: resolved,
    file,
    slots: collectSlots(root, warnings),
    fields: collectFields(root),
  }
}

function splitSingleDocument(doc: Document, file: string, warnings: string[]): ManifestStep[] {
  const marked = [...doc.querySelectorAll(`[${CB.step}]`)]
  if (marked.length > 0) {
    return marked.map((el, i) => scanRoot(el, file, `step_${i + 1}`, warnings))
  }
  const sections = [...doc.querySelectorAll('section')]
  if (sections.length > 1) {
    warnings.push(`${file}: no data-cb-step; split on <section>`)
    return sections.map((el, i) => scanRoot(el, file, `step_${i + 1}`, warnings))
  }
  const headings = [...doc.querySelectorAll('h1')]
  if (headings.length > 1) {
    warnings.push(`${file}: no data-cb-step; split on headings`)
    return headings.map((h, i) => {
      const wrap = doc.createElement('section')
      wrap.append(h.cloneNode(true))
      let n = h.nextElementSibling
      while (n && n.tagName !== 'H1') {
        wrap.append(n.cloneNode(true))
        n = n.nextElementSibling
      }
      return scanRoot(wrap, file, `step_${i + 1}`, warnings)
    })
  }
  return [scanRoot(doc.body, file, slug(file.replace(/\.[^.]+$/, ''), 'step'), warnings)]
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
  const start =
    files.find((f) => /index|value|start/i.test(f.path))?.path ?? files[0]?.path
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
  const htmlFiles = artifact.files.filter((f) => /\.html?$/i.test(f.path) || !f.path.includes('.'))
  const steps: ManifestStep[] = []

  if (htmlFiles.length === 1) {
    const f = htmlFiles[0]
    const doc = parseHtml(f.html)
    steps.push(...splitSingleDocument(doc, f.path, warnings))
  } else {
    const marked: ManifestStep[] = []
    let anyMarked = false
    for (const f of htmlFiles) {
      const doc = parseHtml(f.html)
      const nodes = [...doc.querySelectorAll(`[${CB.step}]`)]
      if (nodes.length > 0) {
        anyMarked = true
        marked.push(...nodes.map((el, i) => scanRoot(el, f.path, `${slug(f.path, 'p')}_${i}`, warnings)))
      } else {
        marked.push(scanRoot(doc.body, f.path, slug(f.path.replace(/\.[^.]+$/, ''), 'page'), warnings))
      }
    }
    if (!anyMarked) warnings.push('Zip pages had no data-cb-step; each file is one step')
    steps.push(...orderZipSteps(marked, htmlFiles))
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
