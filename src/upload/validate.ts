import { CB, KIND_REQUIREMENTS, isCbKind, type CbKind } from './contract'
import { CB_ACTIONS, isCbAction, type ContractIssue, type TemplateManifest } from './types'

export type ManifestIssue = ContractIssue

const STEP_KINDS = new Set<string>([
  'loss_aversion',
  'survey',
  'offer',
  'pricing_table',
  'checkout',
  'confirmation',
  'outcome_saved',
  'outcome_cancelled',
])

export function formatContractIssue(issue: ContractIssue): string {
  const loc = [issue.file, issue.line != null ? String(issue.line) : null].filter(Boolean).join(':')
  const where = loc ? `${loc} — ` : issue.stepId ? `Step "${issue.stepId}" — ` : ''
  return `${where}${issue.message}`
}

function actionsOn(step: NonNullable<TemplateManifest['steps']>[number]): string[] {
  return step.slots
    .filter((s) => s.type === 'action')
    .map((s) => s.bind ?? s.id.replace(/^action_/, ''))
}

function hasSlotName(step: NonNullable<TemplateManifest['steps']>[number], name: string): boolean {
  return step.slots.some((s) => s.id === name || (s.type === name && (name === 'offer' || name === 'survey')))
}

function kindRequirements(kind: CbKind, step: NonNullable<TemplateManifest['steps']>[number]): ContractIssue[] {
  const req = KIND_REQUIREMENTS[kind]
  const issues: ContractIssue[] = []
  const loc = { file: step.file, line: step.line, stepId: step.id }

  if (req.fieldOrLaStats) {
    const hasField = step.fields.length > 0 || step.slots.some((s) => s.type === 'field')
    const hasLa = hasSlotName(step, 'la_stats') || step.slots.some((s) => s.id === 'la_stats')
    if (!hasField && !hasLa) {
      issues.push({
        level: 'error',
        ...loc,
        message: `Step "${step.id}" (${kind}) needs ${CB.field} or ${CB.slot}="la_stats".`,
      })
    }
  }
  for (const slot of req.slots ?? []) {
    const found =
      hasSlotName(step, slot) ||
      (slot === 'offer' && step.slots.some((s) => s.type === 'offer')) ||
      (slot === 'survey' && step.slots.some((s) => s.type === 'survey'))
    if (!found) {
      issues.push({
        level: 'error',
        ...loc,
        message: `Step "${step.id}" is missing ${CB.slot}="${slot}".`,
      })
    }
  }
  const acts = actionsOn(step)
  for (const action of req.actions ?? []) {
    if (!acts.includes(action)) {
      issues.push({
        level: 'error',
        ...loc,
        message: `Step "${step.id}" is missing ${CB.action}="${action}".`,
      })
    }
  }
  return issues
}

/**
 * Fail-closed structure check. Does not require `confirmed`.
 * Unmarked or incomplete chrome must not proceed to catalog binds.
 */
export function validateContract(manifest: TemplateManifest | undefined): ContractIssue[] {
  const issues: ContractIssue[] = []
  if (!manifest) {
    return [
      {
        level: 'error',
        message: `No ${CB.step} regions found. Start from the Growth kit — do not invent unmarked HTML.`,
      },
    ]
  }
  if (manifest.issues?.length) issues.push(...manifest.issues)

  if (manifest.steps.length === 0) {
    const already = issues.some((i) => i.message.includes(CB.step))
    if (!already) {
      issues.push({
        level: 'error',
        message: `Scan found no ${CB.step} regions. Start from the Growth kit.`,
      })
    }
    return dedupe(issues)
  }

  for (const step of manifest.steps) {
    if (!STEP_KINDS.has(step.kind) || !isCbKind(step.kind)) {
      issues.push({
        level: 'error',
        file: step.file,
        stepId: step.id,
        message: `Step "${step.id}" needs a valid ${CB.kind}.`,
      })
      continue
    }
    issues.push(...kindRequirements(step.kind, step))
  }

  return dedupe(issues)
}

export function contractErrors(manifest: TemplateManifest | undefined): ContractIssue[] {
  return validateContract(manifest).filter((i) => i.level === 'error')
}

export function hasContractErrors(manifest: TemplateManifest | undefined): boolean {
  return contractErrors(manifest).length > 0
}

/** Save-time / publish gate for an uploaded template. */
export function validateManifest(manifest: TemplateManifest | undefined): ManifestIssue[] {
  const issues: ManifestIssue[] = [...validateContract(manifest)]
  if (!manifest) return issues

  if (!manifest.confirmed) {
    issues.push({ level: 'error', message: 'Catalog binds are still a draft. Confirm them before preview or publish.' })
  }

  let hasKeep = false
  let hasCancel = false
  let confirmCount = 0

  for (const step of manifest.steps) {
    for (const slot of step.slots) {
      if (slot.type === 'offer' && !slot.bind) {
        issues.push({
          level: 'error',
          file: step.file,
          stepId: step.id,
          message: `Offer slot on "${step.id}" is not bound to the catalog.`,
        })
      }
      if (slot.type === 'survey' && !slot.bind) {
        issues.push({
          level: 'error',
          file: step.file,
          stepId: step.id,
          message: `Survey slot on "${step.id}" is not bound to a reason list.`,
        })
      }
      if (slot.type === 'action') {
        const action = slot.bind ?? slot.id.replace(/^action_/, '')
        if (!isCbAction(action) && !(CB_ACTIONS as readonly string[]).includes(action)) {
          issues.push({
            level: 'error',
            file: step.file,
            stepId: step.id,
            message: `Action "${action}" on "${step.id}" is not a known ${CB.action}.`,
          })
        }
        if (action === 'keep') hasKeep = true
        if (action === 'cancel') hasCancel = true
      }
      if (slot.type === 'field' && !slot.bind && !step.fields.some((f) => f.name === slot.id)) {
        issues.push({
          level: 'warning',
          file: step.file,
          stepId: step.id,
          message: `Field "${slot.id}" on "${step.id}" is unnamed.`,
        })
      }
    }
    if (step.kind === 'confirmation') confirmCount += 1
  }

  if (confirmCount > 0 && (!hasKeep || !hasCancel)) {
    issues.push({
      level: 'error',
      message: 'Confirmation needs both keep and cancel actions in the HTML.',
    })
  }

  for (const w of manifest.warnings) {
    issues.push({ level: 'warning', message: w })
  }

  return dedupe(issues)
}

export function manifestErrors(manifest: TemplateManifest | undefined): string[] {
  return validateManifest(manifest)
    .filter((i) => i.level === 'error')
    .map(formatContractIssue)
}

export function canPublishUploaded(manifest: TemplateManifest | undefined): boolean {
  return manifestErrors(manifest).length === 0
}

export function canPlayUploaded(manifest: TemplateManifest | undefined): boolean {
  return !!manifest?.confirmed && manifestErrors(manifest).length === 0
}

function dedupe(issues: ContractIssue[]): ContractIssue[] {
  const seen = new Set<string>()
  return issues.filter((i) => {
    const key = `${i.level}:${i.file ?? ''}:${i.line ?? ''}:${i.stepId ?? ''}:${i.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
