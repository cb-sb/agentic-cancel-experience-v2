import type { ReactNode } from 'react'
import type { Experience } from '../../types/experience'
import type { FlowNode, NodeMetrics, SplitMode } from '../../types/orchestration'
import type { EnclosureGrid, StepSlot } from './stepGrid'

export interface PlacedNodeMeta {
  id: string
  icon?: ReactNode | null
  kicker: string
  title: string
  subtitle?: string
  metrics?: NodeMetrics
  dashed?: boolean
}

export interface FlowBranchLayout {
  flow: FlowNode
  branchPercent: number
  experience: Experience | null
  collapsed: boolean
  /** Enclosure box in world units. */
  x: number
  y: number
  w: number
  h: number
  /** Step placement inside the enclosure; null when collapsed or not an experience. */
  grid: EnclosureGrid | null
}

export type SpineNodeData = {
  kind: 'spine'
  placed: PlacedNodeMeta
  selected: boolean
  isAudience: boolean
}

/**
 * Root of the graph. Read-only by design — traffic split is play configuration,
 * so the card summarises and hands editing to the right drawer.
 */
export type SplitCardNodeData = {
  kind: 'splitCard'
  placed: PlacedNodeMeta
  mode: SplitMode
  splitId: string
}

export type ExperienceNodeData = {
  kind: 'experience'
  layout: FlowBranchLayout
  selected: boolean
}

export type TargetNodeData = {
  kind: 'target'
  layout: FlowBranchLayout
  selected: boolean
}

export type StepNodeData = {
  kind: 'step'
  slot: StepSlot
  experienceId: string
}

export type AddBranchNodeData = {
  kind: 'addBranch'
  mode: SplitMode
  splitId: string
}

export type OrchestrationNodeData =
  | SpineNodeData
  | SplitCardNodeData
  | ExperienceNodeData
  | TargetNodeData
  | StepNodeData
  | AddBranchNodeData
