import type { JourneyKind, JourneyStepKind } from '../journey/types'
import type { ManifestField, ManifestSlot, TemplateArtifact, TemplateManifest } from '../upload/types'

/** One reusable primitive extracted from a confirmed upload. */
export interface MerchantComponent {
  id: string
  kind: JourneyStepKind
  label: string
  html: string
  css?: string
  slots: ManifestSlot[]
  fields: ManifestField[]
  sourceStepId: string
}

/** Confirmed upload saved for this merchant — a whole journey plus its components. */
export interface MerchantTemplate {
  id: string
  name: string
  savedAt: number
  kind: JourneyKind
  contractVersion: string
  checksum: string
  artifact: TemplateArtifact
  manifest: TemplateManifest
  stepLabels: string[]
  components: MerchantComponent[]
}
