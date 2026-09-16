import { CONTRACT_VERSION, INGRESS_SCOPE } from '../upload/contract'
import { formatContractIssue, type ManifestIssue } from '../upload/validate'
import { CB_KIND_LABELS, type CbKind } from '../upload/contract'
import type { TemplateManifest } from '../upload/types'

/** Copilot-owned review of a scan. External models do not fill these beats. */
export function scanReviewCopy(args: {
  manifest?: TemplateManifest | null
  issues?: ManifestIssue[]
}): string {
  const issues = (args.issues ?? []).filter((i) => i.level === 'error')
  if (issues.length > 0) {
    const lines = issues.map((i) => `• ${formatContractIssue(i)}`).join('\n')
    return `Contract ${CONTRACT_VERSION} rejected this pack. Unmarked or incomplete chrome cannot be hosted.\n${lines}\nStart from the starter kit. ${INGRESS_SCOPE.out.slice(0, 4).join(', ')} stay in Copilot.`
  }
  const steps = args.manifest?.steps ?? []
  if (steps.length === 0) {
    return `Contract ${CONTRACT_VERSION} found no marked steps. Upload the starter kit, not a free-form page.`
  }
  const chain = steps.map((s) => CB_KIND_LABELS[s.kind as CbKind] ?? s.kind).join(' → ')
  return `Scan found ${steps.length} marked step${steps.length === 1 ? '' : 's'} (${chain}). Contract ${CONTRACT_VERSION} is satisfied. Bind the catalog here — I will match brand and targeting next. I will not take ${INGRESS_SCOPE.out[0]}, ${INGRESS_SCOPE.out[1]}, or ${INGRESS_SCOPE.out[3]} from the file.`
}

export function savedToLibraryCopy(name: string): string {
  return `Saved to My templates as “${name}”. Chrome is reusable; Copilot still fills brand, audience, holdout, and walk.`
}

export function attachedChromeCopy(label: string, posture: string): string {
  return `Attached your ${label} chrome onto ${posture}. The rest of the chain is still a Chargebee posture — then we match brand and targeting.`
}
