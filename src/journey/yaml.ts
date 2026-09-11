import type { ShellLayout } from '../types/experience'
import {
  DEFAULT_JOURNEY_BRAND,
  EMPTY_JOURNEY,
  type AudienceKey,
  type JourneyFile,
  type JourneyKind,
  type JourneyStepFile,
  type JourneyStepKind,
  type JourneyTemplate,
  type OfferKey,
} from './types'

const KINDS = new Set<JourneyKind>(['cancel', 'acquisition'])
const TEMPLATES = new Set<JourneyTemplate>([
  'none',
  'cancel_1',
  'cancel_2',
  'cancel_3',
  'cancel_4',
  'cancel_5',
  'cancel_plan_change',
  'acquire_2',
])
const STEP_KINDS = new Set<JourneyStepKind>([
  'loss_aversion',
  'survey',
  'offer',
  'pricing_table',
  'checkout',
  'confirmation',
  'outcome_saved',
  'outcome_cancelled',
])
const OFFERS = new Set<OfferKey>(['discount', 'pause', 'plan_change', 'extension', 'skip', 'addon'])
const AUDIENCES = new Set<AudienceKey>(['all', 'paying', 'high_value', 'high_risk', 'annual', 'in_trial'])
const SHELLS = new Set<ShellLayout>(['modal', 'fullpage', 'fullpage_scroll'])

function yamlStr(v: string): string {
  if (/[:#\n]|^\s|\s$/.test(v) || v === '') return JSON.stringify(v)
  return v
}

function emitStep(s: JourneyStepFile): string {
  const lines = [`  - id: ${yamlStr(s.id)}`, `    kind: ${s.kind}`]
  if (s.live === false) lines.push('    live: false')
  if (s.headline) lines.push(`    headline: ${yamlStr(s.headline)}`)
  if (s.body) lines.push(`    body: ${yamlStr(s.body)}`)
  if (s.offer) lines.push(`    offer: ${s.offer}`)
  return lines.join('\n')
}

/** The document Code mode shows. Constrained YAML, not TypeScript. */
export function stringifyJourney(file: JourneyFile): string {
  const head = [
    `kind: ${file.kind}`,
    `template: ${file.template}`,
    `name: ${yamlStr(file.name)}`,
    `shell: ${file.shell}`,
    `audience: ${file.audience}`,
    `holdout: ${file.holdout}`,
    'brand:',
    `  merchant: ${yamlStr(file.brand.merchant)}`,
    `  primary: ${yamlStr(file.brand.primary)}`,
    `  corners: ${file.brand.corners}`,
  ]
  if (file.brand.theme) head.push(`  theme: ${JSON.stringify(file.brand.theme)}`)
  if (file.source === 'uploaded') {
    head.push('source: uploaded')
    if (file.artifact) {
      head.push(`artifact_id: ${yamlStr(file.artifact.id)}`)
      head.push(`artifact_checksum: ${file.artifact.checksum}`)
      head.push(`artifact_version: ${file.artifact.version}`)
    }
    if (file.manifest) {
      const compact = {
        steps: file.manifest.steps,
        warnings: file.manifest.warnings,
        confirmed: file.manifest.confirmed,
        subscriberContext: file.manifest.subscriberContext,
        surveyReasons: file.manifest.surveyReasons,
      }
      head.push(`manifest: ${JSON.stringify(compact)}`)
    }
  }
  if (file.steps.length === 0) return `${head.join('\n')}\nsteps: []\n`
  return `${head.join('\n')}\nsteps:\n${file.steps.map(emitStep).join('\n')}\n`
}

function unquote(raw: string): string {
  const t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    try {
      return JSON.parse(t.startsWith("'") ? `"${t.slice(1, -1)}"` : t)
    } catch {
      return t.slice(1, -1)
    }
  }
  return t
}

function parseScalar(raw: string): string | boolean {
  const t = unquote(raw)
  if (t === 'true') return true
  if (t === 'false') return false
  return t
}

/**
 * A parser for this file only. Invalid edits bounce with one line, which is
 * what Code mode needs — not a general YAML engine.
 */
export function parseJourney(text: string): { file?: JourneyFile; error?: string } {
  const file: JourneyFile = {
    ...EMPTY_JOURNEY,
    steps: [],
    brand: { ...DEFAULT_JOURNEY_BRAND },
  }
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let inSteps = false
  let inBrand = false
  let current: JourneyStepFile | null = null

  const flush = () => {
    if (current) {
      if (!current.id) return 'A step is missing id'
      if (!current.kind) return 'A step is missing kind'
      file.steps.push(current)
      current = null
    }
    return null
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.replace(/#.*$/, '')
    if (!line.trim()) continue
    const n = i + 1

    if (inBrand && /^\s+\S/.test(raw) && !inSteps) {
      const themeLine = raw.match(/^\s+theme:\s*(.*)$/)
      if (themeLine) {
        try {
          file.brand.theme = JSON.parse(themeLine[1].trim()) as JourneyFile['brand']['theme']
        } catch {
          return { error: `Line ${n}: theme must be JSON` }
        }
        continue
      }
      const bm = line.match(/^\s+([a-z]+):\s*(.*)$/)
      if (!bm) return { error: `Line ${n}: expected a brand field` }
      const val = String(parseScalar(bm[2]))
      if (bm[1] === 'merchant') file.brand.merchant = val
      else if (bm[1] === 'primary') file.brand.primary = val
      else if (bm[1] === 'corners') {
        const corners = Number(val)
        if (!Number.isFinite(corners) || corners < 0 || corners > 32) {
          return { error: `Line ${n}: corners must be 0–32` }
        }
        file.brand.corners = corners
      } else return { error: `Line ${n}: unknown brand field ${bm[1]}` }
      continue
    }
    inBrand = false

    if (!inSteps) {
      if (/^steps:\s*\[\s*\]\s*$/.test(line.trim())) {
        inSteps = true
        continue
      }
      if (/^steps:\s*$/.test(line.trim())) {
        inSteps = true
        continue
      }
      const m = line.match(/^([a-z_]+):\s*(.*)$/)
      if (!m) return { error: `Line ${n}: expected a field` }
      const [, key, val] = m
      const v = String(parseScalar(val))
      if (key === 'kind') {
        if (!KINDS.has(v as JourneyKind)) return { error: `Line ${n}: kind must be cancel or acquisition` }
        file.kind = v as JourneyKind
      } else if (key === 'template') {
        if (!TEMPLATES.has(v as JourneyTemplate)) return { error: `Line ${n}: unknown template` }
        file.template = v as JourneyTemplate
      } else if (key === 'name') file.name = v
      else if (key === 'shell') {
        if (!SHELLS.has(v as ShellLayout)) return { error: `Line ${n}: unknown shell` }
        file.shell = v as ShellLayout
      } else if (key === 'audience') {
        if (!AUDIENCES.has(v as AudienceKey)) return { error: `Line ${n}: unknown audience` }
        file.audience = v as AudienceKey
      } else if (key === 'holdout') {
        const holdout = Number(v)
        if (!Number.isFinite(holdout) || holdout < 0 || holdout > 50) {
          return { error: `Line ${n}: holdout must be 0–50` }
        }
        file.holdout = holdout
      } else if (key === 'brand') {
        inBrand = true
      } else if (key === 'source') {
        if (v !== 'authored' && v !== 'uploaded') return { error: `Line ${n}: source must be authored or uploaded` }
        file.source = v
      } else if (key === 'artifact_id') {
        file.artifact = {
          id: v,
          checksum: file.artifact?.checksum ?? '',
          version: file.artifact?.version ?? 1,
          files: file.artifact?.files ?? [],
        }
      } else if (key === 'artifact_checksum') {
        file.artifact = {
          id: file.artifact?.id ?? '',
          checksum: v,
          version: file.artifact?.version ?? 1,
          files: file.artifact?.files ?? [],
        }
      } else if (key === 'artifact_version') {
        const version = Number(v)
        file.artifact = {
          id: file.artifact?.id ?? '',
          checksum: file.artifact?.checksum ?? '',
          version: Number.isFinite(version) ? version : 1,
          files: file.artifact?.files ?? [],
        }
      } else if (key === 'manifest') {
        try {
          file.manifest = JSON.parse(val) as JourneyFile['manifest']
        } catch {
          return { error: `Line ${n}: manifest must be JSON` }
        }
      } else return { error: `Line ${n}: unknown field ${key}` }
      continue
    }

    const item = line.match(/^\s+-\s+id:\s*(.*)$/)
    if (item) {
      const err = flush()
      if (err) return { error: err }
      current = { id: String(parseScalar(item[1])), kind: 'survey' }
      continue
    }
    const field = line.match(/^\s{2,}([a-z]+):\s*(.*)$/)
    if (!field || !current) return { error: `Line ${n}: expected a step field` }
    const key = field[1]
    const parsed = parseScalar(field[2])
    if (key === 'id') current.id = String(parsed)
    else if (key === 'kind') {
      if (!STEP_KINDS.has(parsed as JourneyStepKind)) return { error: `Line ${n}: unknown step kind` }
      current.kind = parsed as JourneyStepKind
    } else if (key === 'live') current.live = parsed === true
    else if (key === 'headline') current.headline = String(parsed)
    else if (key === 'body') current.body = String(parsed)
    else if (key === 'offer') {
      if (!OFFERS.has(parsed as OfferKey)) return { error: `Line ${n}: unknown offer` }
      current.offer = parsed as OfferKey
    } else return { error: `Line ${n}: unknown step field ${key}` }
  }

  const err = flush()
  if (err) return { error: err }
  if (file.template === 'none' && file.steps.length === 0) return { file }
  if (!file.kind) return { error: 'kind is required' }
  return { file }
}
