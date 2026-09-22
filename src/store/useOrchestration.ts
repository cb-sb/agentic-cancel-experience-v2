import { create } from 'zustand'
import { uid } from '../lib/id'
import type { JourneyTemplate } from '../journey/types'
import { seedPlay } from '../lib/orchestrationSeed'
import type { LibraryTab, SetupDoor } from '../orchestration/copilotStage'
import type { ConfirmedSetup, SetupItemId } from '../orchestration/setupTracker'
import {
  TRACKER_SPOTLIGHTS,
  type SpotlightId,
} from '../orchestration/spotlight'
import { useExperience } from './useExperience'
import {
  CONTROL,
  FALLBACK,
  SUBSCRIBER_PROPERTIES,
  type Audience,
  type BranchRole,
  type FlowNode,
  type Play,
  type RoutingBranch,
  type RoutingNode,
  type SplitMode,
  type SplitNode,
  type TargetType,
  type Trigger,
} from '../types/orchestration'

export type WorkspaceView = 'canvas' | 'editor'

/** Where the setup-assistant chat window is docked. */
export type DockPosition = 'left' | 'bottom-left'

/** Kinds of canvas element that can be annotated. */
export type AnnotationKind = 'trigger' | 'audience' | 'split' | 'flow' | 'holdout' | 'step'

/** The element a floating annotation composer is attached to. */
export interface AnnotationTarget {
  /** Layout id used to anchor the composer (node id, or `${flowId}:${stepId}` for steps). */
  id: string
  kind: AnnotationKind
  /** Human label surfaced in the chat thread, e.g. "Traffic split" or "Step 2 · Offer". */
  label: string
  /** For step targets: the experience + step being annotated. */
  experienceId?: string
  stepId?: string
}

/**
 * Meta configuration sections: play-level settings rather than workflow
 * elements, so they live in a rail on the canvas edge instead of on the canvas
 * itself, and stay reachable at any zoom level.
 *
 * Trigger is not among them. A cancel experience is entered from the merchant's
 * own cancel link, so there is nothing to decide, and the section has never had
 * a panel — the assistant used to ask for it and get a drawer that opened on
 * nothing.
 */
export type PlayConfigSection = 'audience' | 'targeting'

/** The single step isolated for detailed editing, or null on the open canvas. */
export interface FocusTarget {
  experienceId: string
  stepId: string
}

/**
 * How focus mode presents itself.
 *
 * `overlay` takes the surface and scrims the play behind it; `drawer` floats
 * over the canvas from the right so the play stays live beside the card. Two
 * answers to the same question — how much context is worth how much room — kept
 * side by side until one of them earns it.
 */
export type FocusPresentation = 'overlay' | 'drawer'

export function findNode(root: RoutingNode, id: string): RoutingNode | null {
  if (root.id === id) return root
  if (root.kind === 'split') {
    for (const b of root.branches) {
      const found = findNode(b.node, id)
      if (found) return found
    }
  }
  return null
}

function mapNode(root: RoutingNode, id: string, fn: (n: RoutingNode) => RoutingNode): RoutingNode {
  if (root.id === id) return fn(root)
  if (root.kind === 'split') {
    return {
      ...root,
      branches: root.branches.map((b) => ({ ...b, node: mapNode(b.node, id, fn) })),
    }
  }
  return root
}

function findSplit(root: RoutingNode, splitId: string): SplitNode | null {
  const n = findNode(root, splitId)
  return n && n.kind === 'split' ? n : null
}

const VARIANT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function variantLabel(index: number): string {
  return `Variant ${VARIANT_LETTERS[index] ?? String(index + 1)}`
}

/** A fresh, empty sub-audience rule set. */
function blankSubAudience(name: string): Audience {
  return {
    id: uid('rule'),
    name,
    ruleType: 'TARGETING',
    match: 'AND',
    conditions: [{ id: uid('cond'), property: SUBSCRIBER_PROPERTIES[0], operator: 'is', value: '' }],
  }
}

function makeFlowBranch(opts: {
  display: string
  experienceId: string
  role?: BranchRole
  percent?: number
  audience?: Audience
  name?: string
}): RoutingBranch {
  return {
    id: uid('branch'),
    name: opts.name ?? opts.display.toLowerCase().replace(/\s+/g, '_'),
    percent: opts.percent ?? 0,
    role: opts.role,
    audience: opts.audience,
    node: {
      id: uid('flow'),
      kind: 'flow',
      name: opts.display,
      target: 'CANCEL_PAGE',
      experienceId: opts.experienceId,
    },
  }
}

function makeHoldoutBranch(percent: number): RoutingBranch {
  return {
    id: uid('branch'),
    name: CONTROL,
    percent,
    node: { id: uid('holdout'), kind: 'holdout', name: CONTROL, target: 'NONE' },
  }
}

/** Distribute 100% evenly across branches, giving leftover points to the first rows. */
function withEvenPercents(branches: RoutingBranch[]): RoutingBranch[] {
  const n = branches.length
  if (n === 0) return branches
  const base = Math.floor(100 / n)
  const remainder = 100 - base * n
  return branches.map((b, i) => ({ ...b, percent: base + (i < remainder ? 1 : 0) }))
}

interface OrchestrationState {
  play: Play
  view: WorkspaceView
  templatesOpen: boolean
  libraryTab: LibraryTab
  /** Copilot consumes this to start the same draft-plan path as a suggestion chip. */
  pendingLibraryTemplate: Exclude<JourneyTemplate, 'none'> | null
  pendingMerchantTemplate: string | null
  pendingMerchantComponents: string[] | null
  pendingMerchantFinish: boolean
  /** True after My templates added chrome this visit — Done / close should propose if canvas isn’t open. */
  merchantComponentApplied: boolean
  /** Canvas demo asked Copilot to open the job guide. */
  pendingCopilotGuide: boolean
  selectedNodeId: string | null
  openFlowNodeId: string | null
  /** Flow-node ids whose experience enclosure is collapsed to a summary card. */
  collapsedFlows: Record<string, boolean>
  /** Flow-node ids zoomed to full 1:1 step scale for inline editing (default: preview). */
  detailFlows: Record<string, boolean>
  /** Setup-assistant dock position (Cursor-like). */
  dockPosition: DockPosition
  /** Whether the setup-assistant side pane is open (pushes the canvas). */
  assistantOpen: boolean
  /**
   * Rail Copilot takes `ASSISTANT_EXPANDED_W` (50vw) instead of the reduced
   * 400px column. Default on so a landed template does not shrink the chat.
   */
  copilotRailExpanded: boolean
  /** Cursor design-mode: click a canvas element to ask about it. */
  annotateMode: boolean
  /** Element currently being annotated (inline composer open), or null. */
  annotationTarget: AnnotationTarget | null
  /** Meta configuration section open in the right drawer, or null. */
  configTarget: PlayConfigSection | null
  /** Step isolated in focus mode, or null. */
  focusTarget: FocusTarget | null
  /**
   * How focus mode presents itself. Two are being trialled against each other:
   * an overlay that takes the surface and scrims the play, and a drawer that
   * floats over the canvas so the play stays live beside the card. Switchable
   * at runtime, including mid-edit, since comparing them means doing the same
   * piece of work twice. The drawer leads: expanding a step is meant to keep
   * the rest of the play beside it, and the overlay is the thing being checked
   * against that.
   */
  focusPresentation: FocusPresentation
  /** When the draft was last written, or null if it never has been. */
  savedAt: number | null
  /** Whether the play or its experiences have changed since that write. */
  dirty: boolean
  /** Blank-state door the merchant chose this session, or null on the doors screen. */
  setupDoor: SetupDoor | null
  /** True after Copilot has started the door's journey — survives remount when the rail snaps in. */
  setupDoorConsumed: boolean
  /** Center Copilot peeled to a 50vw right rail so the three doors stay visible. */
  copilotDocked: boolean
  /** Copilot has shown the step strip; required to leave center stage. */
  stepStripShown: boolean
  /** Beats the merchant confirmed — defaults do not count until this is set. */
  confirmedSetup: ConfirmedSetup
  walkedOrSkipped: boolean
  dismissedStepNeedsWork: boolean
  trackerOpen: boolean
  publishGapsOpen: boolean
  /** Surface Copilot is pointing at, or null after the pulse expires. */
  spotlight: SpotlightId | null
  /** Bumps when the same target is pointed at again so the frame re-scrolls. */
  spotlightNonce: number

  openTemplates: (tab?: LibraryTab) => void
  closeTemplates: () => void
  setLibraryTab: (tab: LibraryTab) => void
  applyLibraryTemplate: (id: Exclude<JourneyTemplate, 'none'>) => void
  consumeLibraryTemplate: () => void
  applyMerchantTemplate: (id: string) => void
  applyMerchantComponents: (ids: string[]) => void
  finishMerchantComponents: () => void
  consumeMerchantLibrary: () => void
  consumeMerchantComponents: () => void
  consumeMerchantFinish: () => void
  requestCopilotGuide: () => void
  consumeCopilotGuide: () => void
  selectNode: (id: string | null) => void
  openFlow: (nodeId: string) => void
  backToCanvas: () => void
  toggleFlowCollapsed: (flowId: string) => void
  toggleFlowDetail: (flowId: string) => void
  setDockPosition: (pos: DockPosition) => void
  setAssistantOpen: (open: boolean) => void
  setCopilotRailExpanded: (expanded: boolean) => void
  setAnnotateMode: (on: boolean) => void
  openAnnotation: (target: AnnotationTarget) => void
  closeAnnotation: () => void
  openConfig: (section: PlayConfigSection) => void
  closeConfig: () => void
  /** Isolate one step for detailed editing. */
  focusStep: (target: FocusTarget) => void
  exitFocus: () => void
  setFocusPresentation: (presentation: FocusPresentation) => void
  chooseDoor: (door: SetupDoor) => void
  consumeSetupDoor: () => void
  /** Peel center Copilot to a 50vw right rail over the doors. */
  dockCopilot: () => void
  markStepStripShown: () => void
  confirmSetupItem: (id: SetupItemId) => void
  setWalkedOrSkipped: (value: boolean) => void
  dismissStepNeedsWork: () => void
  setTrackerOpen: (open: boolean) => void
  setPublishGapsOpen: (open: boolean) => void
  setSpotlight: (id: SpotlightId | null, ms?: number) => void
  resetSetup: () => void

  updatePlay: (patch: Partial<Play>) => void
  updateAudience: (patch: Partial<Audience>) => void
  updateTrigger: (patch: Partial<Trigger>) => void
  togglePublish: () => void

  setSplitPercents: (splitId: string, percents: Record<string, number>) => void
  renameNode: (nodeId: string, name: string) => void
  updateFlowNode: (flowId: string, patch: Partial<FlowNode>) => void
  setFlowTarget: (flowId: string, target: TargetType) => void
  setFlowExperience: (flowId: string, experienceId: string) => void
  /** Append a variant flow using an already-created experience (uncapped). */
  addTreatmentBranch: (splitId: string, experienceId: string, branchName?: string) => void

  /** Switch a split between single / A-B percent / sub-audience routing. */
  setSplitMode: (splitId: string, mode: SplitMode) => void
  /** Duplicate the control experience into a new A/B variant (uncapped). */
  addVariant: (splitId: string) => void
  /** Add a rule-based sub-audience segment (+ ensure a fallback experience). */
  addSubAudience: (splitId: string) => void
  /** Remove a variant/segment branch (never the fallback or the last experience). */
  removeBranch: (splitId: string, branchId: string) => void
  /** Rebalance percent branches to an even split. */
  evenSplit: (splitId: string) => void
  /** Add or remove a no-treatment holdout (percent mode). */
  toggleHoldout: (splitId: string) => void
  /** Edit a segment branch's sub-audience rules. */
  updateBranchAudience: (splitId: string, branchId: string, patch: Partial<Audience>) => void
}

let spotlightTimer: number | undefined

export const useOrchestration = create<OrchestrationState>((set, get) => ({
  play: seedPlay(),
  view: 'canvas',
  templatesOpen: false,
  libraryTab: 'ours' as LibraryTab,
  pendingLibraryTemplate: null,
  pendingMerchantTemplate: null,
  pendingMerchantComponents: null,
  pendingMerchantFinish: false,
  merchantComponentApplied: false,
  pendingCopilotGuide: false,
  selectedNodeId: null,
  openFlowNodeId: null,
  collapsedFlows: {},
  detailFlows: {},
  dockPosition: 'bottom-left',
  assistantOpen: true,
  copilotRailExpanded: true,
  annotateMode: false,
  annotationTarget: null,
  configTarget: null,
  focusTarget: null,
  focusPresentation: 'drawer',
  savedAt: null,
  dirty: false,
  setupDoor: null,
  setupDoorConsumed: false,
  copilotDocked: false,
  stepStripShown: false,
  confirmedSetup: {},
  walkedOrSkipped: false,
  dismissedStepNeedsWork: false,
  trackerOpen: false,
  publishGapsOpen: false,
  spotlight: null,
  spotlightNonce: 0,

  openTemplates: (tab) =>
    set(tab ? { templatesOpen: true, libraryTab: tab } : { templatesOpen: true }),
  closeTemplates: () => {
    const applied = get().merchantComponentApplied
    const finish = applied && !get().stepStripShown
    set({
      templatesOpen: false,
      merchantComponentApplied: false,
      pendingMerchantComponents: null,
      pendingMerchantFinish: finish,
      ...(finish
        ? { setupDoor: get().setupDoor ?? 'yours', setupDoorConsumed: true, assistantOpen: true }
        : {}),
    })
  },
  setLibraryTab: (libraryTab) => set({ libraryTab }),
  applyLibraryTemplate: (id) =>
    set({
      pendingLibraryTemplate: id,
      templatesOpen: false,
      setupDoor: 'library',
      setupDoorConsumed: true,
      assistantOpen: true,
    }),
  consumeLibraryTemplate: () => set({ pendingLibraryTemplate: null }),
  applyMerchantTemplate: (id) =>
    set({
      pendingMerchantTemplate: id,
      templatesOpen: false,
      setupDoor: 'yours',
      setupDoorConsumed: true,
      assistantOpen: true,
    }),
  applyMerchantComponents: (ids) => set({ pendingMerchantComponents: ids, merchantComponentApplied: true }),
  finishMerchantComponents: () => {
    const applied = get().merchantComponentApplied
    const finish = applied && !get().stepStripShown
    set({
      templatesOpen: false,
      merchantComponentApplied: false,
      pendingMerchantComponents: null,
      pendingMerchantFinish: finish,
      ...(finish
        ? { setupDoor: get().setupDoor ?? 'yours', setupDoorConsumed: true, assistantOpen: true }
        : {}),
    })
  },
  consumeMerchantLibrary: () => set({ pendingMerchantTemplate: null, pendingMerchantComponents: null }),
  consumeMerchantComponents: () => set({ pendingMerchantComponents: null }),
  consumeMerchantFinish: () => set({ pendingMerchantFinish: false }),
  requestCopilotGuide: () => set({ pendingCopilotGuide: true, assistantOpen: true }),
  consumeCopilotGuide: () => set({ pendingCopilotGuide: false }),

  // Selecting an experience hands the right pane to branding, so the pinned play
  // section has to let go; deselecting hands the pane back to play config.
  selectNode: (id) => set(id ? { selectedNodeId: id, configTarget: null } : { selectedNodeId: null }),

  setDockPosition: (pos) => set({ dockPosition: pos }),
  setAssistantOpen: (open) => {
    // Copilot is the editor while a step is in focus — folding it to the
    // launcher would leave the merchant without the pane that replaced the
    // old side inspector. Preview is the exception: it takes the surface, so
    // Copilot folds away for the duration.
    if (!open && get().focusTarget && useExperience.getState().mode !== 'play') return
    set({ assistantOpen: open })
  },
  setCopilotRailExpanded: (expanded) => set({ copilotRailExpanded: expanded }),
  setAnnotateMode: (on) =>
    set({
      annotateMode: on,
      annotationTarget: on ? get().annotationTarget : null,
      assistantOpen: on ? true : get().assistantOpen,
    }),
  openAnnotation: (target) => set({ annotationTarget: target, assistantOpen: true }),
  closeAnnotation: () => set({ annotationTarget: null }),
  // The right pane is a single surface, so opening config takes it over from
  // brand and from focus. A null target means "no section pinned yet", which the
  // pane resolves to trigger — it is never closed.
  openConfig: (section) => set({ configTarget: section, focusTarget: null, selectedNodeId: null }),
  closeConfig: () => set({ configTarget: null }),

  focusStep: (target) => {
    useExperience.getState().setActiveExperience(target.experienceId)
    useExperience.getState().setActiveStep(target.stepId)
    // Inline edit always comes with Copilot in annotate mode so the merchant
    // can point at the 1:1 card (or the play beside it) and ask about it.
    set({
      focusTarget: target,
      annotationTarget: null,
      assistantOpen: true,
      annotateMode: true,
    })
  },
  exitFocus: () => set({ focusTarget: null }),
  setFocusPresentation: (focusPresentation) => set({ focusPresentation }),

  chooseDoor: (door) => {
    if (door === 'library') {
      set({ templatesOpen: true, libraryTab: 'ours' })
      return
    }
    if (door === 'yours') {
      set({ templatesOpen: true, libraryTab: 'yours' })
      return
    }
    set({ setupDoor: door, setupDoorConsumed: false, assistantOpen: true })
  },
  consumeSetupDoor: () => set({ setupDoorConsumed: true }),
  dockCopilot: () => set({ copilotDocked: true, assistantOpen: true }),
  markStepStripShown: () => set({ stepStripShown: true }),
  confirmSetupItem: (id) =>
    set((s) => ({ confirmedSetup: { ...s.confirmedSetup, [id]: true } })),
  setWalkedOrSkipped: (walkedOrSkipped) =>
    set((s) => ({
      walkedOrSkipped,
      confirmedSetup: walkedOrSkipped ? { ...s.confirmedSetup, walk: true } : s.confirmedSetup,
    })),
  dismissStepNeedsWork: () => set({ dismissedStepNeedsWork: true }),
  setTrackerOpen: (trackerOpen) => set({ trackerOpen }),
  setPublishGapsOpen: (publishGapsOpen) => set({ publishGapsOpen }),
  setSpotlight: (id, ms = 12000) => {
    if (spotlightTimer != null) window.clearTimeout(spotlightTimer)
    spotlightTimer = undefined
    if (!id) {
      set({ spotlight: null })
      return
    }
    set((s) => ({
      spotlight: id,
      spotlightNonce: s.spotlightNonce + 1,
      ...(TRACKER_SPOTLIGHTS.includes(id) && id !== 'journey' ? { trackerOpen: true } : {}),
    }))
    if (ms > 0) {
      spotlightTimer = window.setTimeout(() => {
        if (get().spotlight === id) set({ spotlight: null })
      }, ms)
    }
  },
  resetSetup: () => {
    if (spotlightTimer != null) window.clearTimeout(spotlightTimer)
    spotlightTimer = undefined
    set({
      setupDoor: null,
      setupDoorConsumed: false,
      copilotDocked: false,
      stepStripShown: false,
      confirmedSetup: {},
      walkedOrSkipped: false,
      dismissedStepNeedsWork: false,
      trackerOpen: false,
      publishGapsOpen: false,
      spotlight: null,
      templatesOpen: false,
      libraryTab: 'ours',
      pendingLibraryTemplate: null,
      pendingMerchantTemplate: null,
      pendingMerchantComponents: null,
      pendingMerchantFinish: false,
      merchantComponentApplied: false,
      assistantOpen: true,
      copilotRailExpanded: true,
    })
  },

  toggleFlowCollapsed: (flowId) =>
    set((s) => ({ collapsedFlows: { ...s.collapsedFlows, [flowId]: !s.collapsedFlows[flowId] } })),

  toggleFlowDetail: (flowId) =>
    set((s) => ({ detailFlows: { ...s.detailFlows, [flowId]: !s.detailFlows[flowId] } })),

  openFlow: (nodeId) => set({ view: 'editor', openFlowNodeId: nodeId, selectedNodeId: null }),

  backToCanvas: () => set({ view: 'canvas', openFlowNodeId: null }),

  updatePlay: (patch) => set((s) => ({ play: { ...s.play, ...patch } })),

  updateAudience: (patch) =>
    set((s) => ({ play: { ...s.play, audience: { ...s.play.audience, ...patch } } })),

  updateTrigger: (patch) =>
    set((s) => ({ play: { ...s.play, trigger: { ...s.play.trigger, ...patch } } })),

  togglePublish: () =>
    set((s) => ({
      play: { ...s.play, publishState: s.play.publishState === 'live' ? 'draft' : 'live' },
    })),

  setSplitPercents: (splitId, percents) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) => {
          if (n.kind !== 'split') return n
          const split = n as SplitNode
          return {
            ...split,
            branches: split.branches.map((b) => ({
              ...b,
              percent: percents[b.id] ?? b.percent,
            })),
          }
        }),
      },
    })),

  renameNode: (nodeId, name) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, nodeId, (n) => ({ ...n, name }) as RoutingNode),
      },
    })),

  updateFlowNode: (flowId, patch) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, flowId, (n) => {
          if (n.kind !== 'flow') return n
          return { ...n, ...patch }
        }),
      },
    })),

  setFlowTarget: (flowId, target) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, flowId, (n) => {
          if (n.kind !== 'flow') return n
          return { ...n, target }
        }),
      },
    })),

  setFlowExperience: (flowId, experienceId) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, flowId, (n) => {
          if (n.kind !== 'flow') return n
          return { ...n, experienceId }
        }),
      },
    })),

  addTreatmentBranch: (splitId, experienceId, branchName) => {
    const split = findSplit(get().play.targeting, splitId)
    if (!split) return
    const variantCount = split.branches.filter((b) => b.role === 'variant').length
    const display = branchName ?? variantLabel(variantCount)
    const newBranch = makeFlowBranch({ display, experienceId, role: 'variant' })
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) => {
          if (n.kind !== 'split') return n
          const branches = n.branches.map((b, i) =>
            i === 0 && b.node.kind === 'flow' && !b.role ? { ...b, role: 'control' as BranchRole } : b,
          )
          const holdoutIdx = branches.findIndex((b) => b.node.kind === 'holdout')
          const next =
            holdoutIdx === -1
              ? [...branches, newBranch]
              : [...branches.slice(0, holdoutIdx), newBranch, ...branches.slice(holdoutIdx)]
          return { ...n, mode: 'percent' as SplitMode, branches: withEvenPercents(next) }
        }),
      },
      collapsedFlows: { ...s.collapsedFlows, [newBranch.node.id]: true },
    }))
  },

  setSplitMode: (splitId, mode) => {
    const split = findSplit(get().play.targeting, splitId)
    if (!split) return
    const flows = split.branches.filter((b) => b.node.kind === 'flow')
    const baseExpId = (flows[0]?.node as FlowNode | undefined)?.experienceId
    let nextBranches: RoutingBranch[] = split.branches
    const collapsePatch: Record<string, boolean> = {}

    if (mode === 'single') {
      const first = flows[0] ?? split.branches[0]
      if (!first) return
      nextBranches = [{ ...first, role: undefined, audience: undefined, percent: 100 }]
    } else if (mode === 'percent') {
      const kept = split.branches.filter((b) => b.role !== 'fallback')
      let flowSeen = 0
      const withRoles = kept.map((b) => {
        if (b.node.kind === 'holdout') return { ...b, audience: undefined }
        const role: BranchRole = flowSeen === 0 ? 'control' : 'variant'
        flowSeen += 1
        return { ...b, role, audience: undefined }
      })
      nextBranches = withEvenPercents(withRoles)
    } else {
      const segs: RoutingBranch[] = flows.map((b, i) => ({
        ...b,
        role: 'segment' as BranchRole,
        audience:
          b.audience ??
          blankSubAudience(b.node.kind === 'flow' ? b.node.name : `Sub-audience ${i + 1}`),
      }))
      let fallback = split.branches.find((b) => b.role === 'fallback')
      if (!fallback && baseExpId) {
        const fbExp = useExperience.getState().duplicateExperience(baseExpId, 'Fallback experience')
        fallback = makeFlowBranch({
          display: 'Fallback experience',
          experienceId: fbExp,
          role: 'fallback',
          name: FALLBACK,
        })
        collapsePatch[fallback.node.id] = true
      }
      nextBranches = fallback ? [...segs, fallback] : segs
    }

    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) =>
          n.kind === 'split' ? { ...n, mode, branches: nextBranches } : n,
        ),
      },
      collapsedFlows: { ...s.collapsedFlows, ...collapsePatch },
    }))
  },

  addVariant: (splitId) => {
    const split = findSplit(get().play.targeting, splitId)
    if (!split) return
    const flows = split.branches.filter((b) => b.node.kind === 'flow')
    const baseExpId = (flows[0]?.node as FlowNode | undefined)?.experienceId
    if (!baseExpId) return
    const variantCount = split.branches.filter((b) => b.role === 'variant').length
    const display = variantLabel(variantCount)
    const newExpId = useExperience.getState().duplicateExperience(baseExpId, display)
    const newBranch = makeFlowBranch({ display, experienceId: newExpId, role: 'variant' })

    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) => {
          if (n.kind !== 'split') return n
          const branches = n.branches.map((b, i) =>
            i === 0 && b.node.kind === 'flow' && !b.role ? { ...b, role: 'control' as BranchRole } : b,
          )
          const holdoutIdx = branches.findIndex((b) => b.node.kind === 'holdout')
          const next =
            holdoutIdx === -1
              ? [...branches, newBranch]
              : [...branches.slice(0, holdoutIdx), newBranch, ...branches.slice(holdoutIdx)]
          return { ...n, mode: 'percent' as SplitMode, branches: withEvenPercents(next) }
        }),
      },
      collapsedFlows: { ...s.collapsedFlows, [newBranch.node.id]: true },
    }))
  },

  addSubAudience: (splitId) => {
    const split = findSplit(get().play.targeting, splitId)
    if (!split) return
    const flows = split.branches.filter((b) => b.node.kind === 'flow')
    const baseExpId = (flows[0]?.node as FlowNode | undefined)?.experienceId
    if (!baseExpId) return
    const segCount = split.branches.filter((b) => b.role === 'segment').length
    const display = `Sub-audience ${segCount + 1}`
    const newExpId = useExperience.getState().duplicateExperience(baseExpId, display)
    const newSeg = makeFlowBranch({
      display,
      experienceId: newExpId,
      role: 'segment',
      audience: blankSubAudience(display),
    })
    const collapsePatch: Record<string, boolean> = { [newSeg.node.id]: true }

    let createdFallback: RoutingBranch | null = null
    if (!split.branches.some((b) => b.role === 'fallback')) {
      const fbExp = useExperience.getState().duplicateExperience(baseExpId, 'Fallback experience')
      createdFallback = makeFlowBranch({
        display: 'Fallback experience',
        experienceId: fbExp,
        role: 'fallback',
        name: FALLBACK,
      })
      collapsePatch[createdFallback.node.id] = true
    }

    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) => {
          if (n.kind !== 'split') return n
          const converted = n.branches
            .filter((b) => b.node.kind !== 'holdout')
            .map((b) => {
              if (b.role === 'fallback') return b
              if (b.node.kind === 'flow')
                return {
                  ...b,
                  role: 'segment' as BranchRole,
                  audience: b.audience ?? blankSubAudience(b.node.name),
                }
              return b
            })
          const existingFallback = converted.find((b) => b.role === 'fallback')
          const segs = converted.filter((b) => b.role !== 'fallback')
          const fb = existingFallback ?? createdFallback
          return {
            ...n,
            mode: 'audience' as SplitMode,
            branches: fb ? [...segs, newSeg, fb] : [...segs, newSeg],
          }
        }),
      },
      collapsedFlows: { ...s.collapsedFlows, ...collapsePatch },
    }))
  },

  removeBranch: (splitId, branchId) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) => {
          if (n.kind !== 'split') return n
          const target = n.branches.find((b) => b.id === branchId)
          if (!target || target.role === 'fallback') return n
          const remaining = n.branches.filter((b) => b.id !== branchId)
          const flowsLeft = remaining.filter((b) => b.node.kind === 'flow' && b.role !== 'fallback')
          if (flowsLeft.length === 0) return n
          // A split with one branch left is not a split. Removing the second
          // experience of an A/B test undoes the test, rather than leaving the
          // play claiming to divide traffic between one thing.
          if (remaining.length === 1 && n.mode === 'percent') {
            const flow = remaining[0]
            return {
              ...n,
              mode: 'single' as SplitMode,
              branches: [{ ...flow, role: undefined, audience: undefined, percent: 100 }],
            }
          }
          if (n.mode === 'audience' && remaining.filter((b) => b.role === 'segment').length === 0) {
            const flow = flowsLeft[0]
            return {
              ...n,
              mode: 'single' as SplitMode,
              branches: [{ ...flow, role: undefined, audience: undefined, percent: 100 }],
            }
          }
          return { ...n, branches: n.mode === 'percent' ? withEvenPercents(remaining) : remaining }
        }),
      },
    })),

  evenSplit: (splitId) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) =>
          n.kind === 'split' ? { ...n, branches: withEvenPercents(n.branches) } : n,
        ),
      },
    })),

  toggleHoldout: (splitId) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) => {
          if (n.kind !== 'split') return n
          const hasHoldout = n.branches.some((b) => b.node.kind === 'holdout')
          const branches = hasHoldout
            ? n.branches.filter((b) => b.node.kind !== 'holdout')
            : [...n.branches, makeHoldoutBranch(0)]
          return { ...n, branches: withEvenPercents(branches) }
        }),
      },
    })),

  updateBranchAudience: (splitId, branchId, patch) =>
    set((s) => ({
      play: {
        ...s.play,
        targeting: mapNode(s.play.targeting, splitId, (n) => {
          if (n.kind !== 'split') return n
          return {
            ...n,
            branches: n.branches.map((b) =>
              b.id === branchId
                ? { ...b, audience: { ...(b.audience ?? blankSubAudience('Sub-audience')), ...patch } }
                : b,
            ),
          }
        }),
      },
    })),
}))
