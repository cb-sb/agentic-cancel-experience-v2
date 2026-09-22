import type { JourneyStepChrome, JourneyStepFile } from '../journey/types'
import { CB_KIND_LABELS, type CbKind } from '../upload/contract'
import { htmlForStep } from '../upload/ArtifactPlayer'
import { uid } from '../lib/id'
import { hashChrome } from '../upload/hash'
import type { TemplateArtifact, TemplateManifest } from '../upload/types'
import type { MerchantComponent, MerchantTemplate } from './types'
import { CONTRACT_VERSION } from '../upload/contract'

export function extractComponents(
  artifact: TemplateArtifact,
  manifest: TemplateManifest,
): MerchantComponent[] {
  return manifest.steps.map((step) => {
    const pack = htmlForStep(artifact, step)
    const contentHash = hashChrome(step.kind, pack.html, pack.css)
    return {
      id: uid('cmp'),
      kind: step.kind,
      label: CB_KIND_LABELS[step.kind as CbKind] ?? step.kind,
      html: pack.html,
      css: pack.css,
      slots: step.slots,
      fields: step.fields,
      sourceStepId: step.id,
      contentHash,
      savedAt: Date.now(),
    }
  })
}

export function templateNameFromManifest(manifest: TemplateManifest): string {
  const labels = manifest.steps.map((s) => CB_KIND_LABELS[s.kind as CbKind] ?? s.kind)
  return labels.slice(0, 4).join(' → ') || 'Uploaded template'
}

export function toStepChrome(component: MerchantComponent): JourneyStepChrome {
  return {
    libraryComponentId: component.id,
    html: component.html,
    css: component.css,
    slots: component.slots,
    fields: component.fields,
  }
}

export function packFromChrome(step: JourneyStepFile): {
  artifact: TemplateArtifact
  manifest: TemplateManifest
} | null {
  const chrome = step.chrome
  if (!chrome) return null
  return {
    artifact: {
      id: chrome.libraryComponentId ?? `chrome_${step.id}`,
      checksum: chrome.libraryComponentId ?? step.id,
      version: 1,
      files: [{ path: 'slice.html', html: chrome.html, css: chrome.css }],
    },
    manifest: {
      steps: [
        {
          id: step.id,
          kind: step.kind,
          file: 'slice.html',
          slots: chrome.slots,
          fields: chrome.fields,
        },
      ],
      warnings: [],
      confirmed: true,
    },
  }
}

export function recordFromUpload(
  artifact: TemplateArtifact,
  manifest: TemplateManifest,
  name?: string,
  componentIds: string[] = [],
): MerchantTemplate {
  const confirmed: TemplateManifest = { ...manifest, confirmed: true }
  return {
    id: uid('lib'),
    name: name?.trim() || templateNameFromManifest(confirmed),
    savedAt: Date.now(),
    kind: confirmed.steps.some((s) => s.kind === 'pricing_table' && !confirmed.steps.some((x) => x.kind === 'confirmation'))
      ? 'acquisition'
      : 'cancel',
    contractVersion: CONTRACT_VERSION,
    checksum: artifact.checksum,
    artifact,
    manifest: confirmed,
    stepLabels: confirmed.steps.map((s) => CB_KIND_LABELS[s.kind as CbKind] ?? s.kind),
    componentIds,
  }
}

export function componentsForTemplate(
  template: MerchantTemplate,
  catalog: MerchantComponent[],
): MerchantComponent[] {
  if (template.componentIds?.length) {
    return template.componentIds
      .map((id) => catalog.find((c) => c.id === id))
      .filter((c): c is MerchantComponent => c != null)
  }
  return template.components ?? []
}
