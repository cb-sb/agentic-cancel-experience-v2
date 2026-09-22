import type { JourneyKind, JourneyStepKind } from '../journey/types'
import type { ManifestField, ManifestSlot, TemplateArtifact, TemplateManifest } from '../upload/types'

/** One reusable primitive in the shared catalog. Upserted by chrome hash. */
export interface MerchantComponent {
  id: string
  kind: JourneyStepKind
  label: string
  html: string
  css?: string
  slots: ManifestSlot[]
  fields: ManifestField[]
  sourceStepId: string
  contentHash: string
  /** When this chrome first landed in the catalog. Older rows may omit it. */
  savedAt?: number
}

/** Confirmed composed experience. Points at shared catalog ids. */
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
  componentIds: string[]
  /** @deprecated Nested copy from library v1. Prefer componentIds + catalog. */
  components?: MerchantComponent[]
}
