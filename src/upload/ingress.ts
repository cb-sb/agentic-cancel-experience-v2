/**
 * Versioned public ingress. Merchant chrome enters Growth only through this
 * surface: the slot contract, scan, and confirm validators. Copilot then fills
 * targeting, brand, offers, and publish. Do not wrap this as an authoring skill.
 */
export {
  CB,
  CB_ACTIONS_CONTRACT,
  CB_BINDS,
  CB_FIELDS,
  CB_KIND_ALIASES,
  CB_KIND_LABELS,
  CB_KINDS,
  CB_SLOT_NAMES,
  CONTRACT_VERSION,
  GROWTH_SLOT_SCHEMA,
  INGRESS_SCOPE,
  KIND_REQUIREMENTS,
  isCbKind,
  isCbSlotName,
  parseCbKind,
  type CbKind,
  type CbSlotName,
  type KindRequirement,
} from './contract'

export {
  canPlayUploaded,
  canPublishUploaded,
  contractErrors,
  formatContractIssue,
  hasContractErrors,
  validateContract,
  validateManifest,
} from './validate'
