import { createContext, useContext } from 'react'
import type { Branding, ExperienceComponent, ShellLayout, Step } from '../types/experience'
import type { DeviceKind, PlaySession } from '../store/useExperience'

export interface RenderActions {
  selectReason: (reasonId: string | null) => void
  setReasonText: (key: string, value: string) => void
  acceptOffer: (offerId: string) => void
  declineOffer: () => void
  setConfirmInput: (value: string) => void
  setConsent: (checked: boolean) => void
  setFeedback: (value: string) => void
  confirmCancel: () => void
}

/** Inline-edit callbacks, present only in Compose mode. */
export interface RenderEdit {
  updateStep: (patch: Partial<Step>) => void
  updateComponent: (componentId: string, patch: Partial<ExperienceComponent>) => void
}

/** A survey reason surfaced for the reason→offer mapping UI. */
export interface MappingReason {
  id: string
  label: string
}

/** An offer a reason can be linked to, with its stable mapping color. */
export interface MappingOffer {
  id: string
  title: string
  color: string
}

/**
 * Canvas-only reason↔offer mapping context. Threaded through Compose so the
 * survey card can pick a linked offer and the offer card can show which reasons
 * route to it — with matching colors + DOM anchors for the connector overlay.
 */
export interface MappingInfo {
  /** Experience owning these components — namespaces the connector anchors. */
  experienceId: string
  /** Offers the survey can link to (offers on steps after the survey). */
  linkableOffers: MappingOffer[]
  /** Reasons routed to each offer id (for the offer-card badge). */
  reasonsByOffer: Record<string, MappingReason[]>
  /** Stable mapping color for an offer id (falls back to a neutral gray). */
  colorForOffer: (offerId: string) => string
  /** Focus the offer's step so its settings open in the inspector pane. */
  configureOffer: (offerId: string) => void
}

export type RenderMode = 'compose' | 'play'

export interface RenderCtxValue {
  mode: RenderMode
  /** true only in Play mode — runtime interactions are live. */
  interactive: boolean
  /** Presentation shell: modal dialog vs. hosted full-page. */
  shell: ShellLayout
  /** Preview device — full-page layouts widen the content column on desktop. */
  device: DeviceKind
  branding: Branding
  session: PlaySession
  actions: RenderActions
  /** non-null only in Compose mode. */
  edit: RenderEdit | null
  /** Reason↔offer mapping context — present only for Compose on the canvas. */
  mapping?: MappingInfo | null
}

const noop = () => {}

export const defaultRenderActions: RenderActions = {
  selectReason: noop,
  setReasonText: noop,
  acceptOffer: noop,
  declineOffer: noop,
  setConfirmInput: noop,
  setConsent: noop,
  setFeedback: noop,
  confirmCancel: noop,
}

const RenderContext = createContext<RenderCtxValue | null>(null)

export const RenderProvider = RenderContext.Provider

export function useRenderCtx(): RenderCtxValue {
  const ctx = useContext(RenderContext)
  if (!ctx) throw new Error('useRenderCtx must be used within a RenderProvider')
  return ctx
}
