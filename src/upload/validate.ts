import { CB_ACTIONS, isCbAction, type TemplateManifest } from './types'

export interface ManifestIssue {
  level: 'error' | 'warning'
  message: string
}

const STEP_KINDS = new Set([
  'loss_aversion',
  'survey',
  'offer',
  'pricing_table',
  'checkout',
  'confirmation',
  'outcome_saved',
  'outcome_cancelled',
])

/** Save-time / publish gate for an uploaded template. */
export function validateManifest(manifest: TemplateManifest | undefined): ManifestIssue[] {
  const issues: ManifestIssue[] = []
  if (!manifest) {
    return [{ level: 'error', message: 'No template mappings yet — confirm the scanned steps.' }]
  }
  if (!manifest.confirmed) {
    issues.push({ level: 'error', message: 'Mappings are still a draft. Confirm them before preview or publish.' })
  }
  if (manifest.steps.length === 0) {
    issues.push({ level: 'error', message: 'Scan found no steps. Upload HTML with sections, or a zip of pages.' })
    return issues
  }

  let hasKeep = false
  let hasCancel = false
  let confirmCount = 0

  for (const step of manifest.steps) {
    if (!STEP_KINDS.has(step.kind)) {
      issues.push({ level: 'error', message: `Step "${step.id}" needs a kind.` })
    }
    for (const slot of step.slots) {
      if (slot.type === 'offer' && !slot.bind) {
        issues.push({ level: 'error', message: `Offer slot on "${step.id}" is not bound to the catalog.` })
      }
      if (slot.type === 'survey' && !slot.bind) {
        issues.push({ level: 'error', message: `Survey slot on "${step.id}" is not bound to a reason list.` })
      }
      if (slot.type === 'action') {
        const action = slot.bind ?? slot.id.replace(/^action_/, '')
        if (!isCbAction(action) && !(CB_ACTIONS as readonly string[]).includes(action)) {
          issues.push({ level: 'error', message: `Action "${action}" on "${step.id}" is not a known data-cb-action.` })
        }
        if (action === 'keep') hasKeep = true
        if (action === 'cancel') hasCancel = true
      }
      if (slot.type === 'field' && !slot.bind && !step.fields.some((f) => f.name === slot.id)) {
        issues.push({ level: 'warning', message: `Field "${slot.id}" on "${step.id}" is unnamed.` })
      }
    }
    if (step.kind === 'confirmation') confirmCount += 1
  }

  if (confirmCount > 0 && (!hasKeep || !hasCancel)) {
    issues.push({
      level: 'error',
      message: 'Confirmation needs both keep and cancel actions mapped.',
    })
  }

  for (const w of manifest.warnings) {
    issues.push({ level: 'warning', message: w })
  }

  return issues
}

export function manifestErrors(manifest: TemplateManifest | undefined): string[] {
  return validateManifest(manifest)
    .filter((i) => i.level === 'error')
    .map((i) => i.message)
}

export function canPublishUploaded(manifest: TemplateManifest | undefined): boolean {
  return manifestErrors(manifest).length === 0
}

export function canPlayUploaded(manifest: TemplateManifest | undefined): boolean {
  return !!manifest?.confirmed && manifestErrors(manifest).length === 0
}
