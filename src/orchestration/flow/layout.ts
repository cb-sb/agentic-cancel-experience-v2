import type { Edge, Node } from '@xyflow/react'
import { eventText, reasonEventText, type PlayEventId } from '../../lib/events'
import { colorForOfferFactory } from '../../lib/mapping'
import type { Experience, Step, SurveyReasonOption } from '../../types/experience'
import { branchLabel, branchName, experimentKicker, experimentTitle } from '../../types/orchestration'
import type { FlowNode, Play, RoutingBranch, SplitMode, SplitNode } from '../../types/orchestration'
import { isExperienceTarget } from '../ExperienceEnclosure'
import {
  ADD_BRANCH_H,
  CARD_H,
  CARD_W,
  COLLAPSED_H,
  COLLAPSED_W,
  COL_GAP,
  DEMO_ENCLOSURE_H,
  DEMO_ENCLOSURE_W,
  DEMO_FOOTER_ALLOWANCE,
  ENCLOSURE_GAP,
  LANE_X0,
  ROW_GAP,
  STEP_H,
  STEP_W,
  TARGET_H,
  TARGET_W,
  STEP_WIRE_COLOR,
  TITLE_ALLOWANCE,
  WIRE_COLOR,
  Y_MID,
} from './canvasTokens'
import { offerPortId, portRows } from './ports'
import { strip } from './tiers/stepFacts'
import { enclosureGrid, type EnclosureGrid } from './stepGrid'
import type { FlowBranchLayout, PlacedNodeMeta } from './types'

export const colX = (col: number) => LANE_X0 + col * (CARD_W + COL_GAP)

/**
 * Square corners, no arrowheads: the wires read as a circuit rather than a
 * diagram, and the dot on each source handle already shows which end they leave
 * from. `step` also keeps every branch's trunk on one shared vertical line.
 *
 * The stroke is a screen-space width applied in CSS (see `index.css`), so wires
 * hold their weight instead of thinning out as the canvas zooms away.
 */
const WIRE = { type: 'step' as const, style: { stroke: WIRE_COLOR } }
/** Inside an experience the wires are structure, not traffic: quieter, not faint. */
const STEP_WIRE = {
  type: 'journey' as const,
  className: 'step-wire',
  style: { stroke: STEP_WIRE_COLOR },
}

/** One-line description of how the split divides traffic. */
export function splitSummary(split: SplitNode): string {
  if (split.mode === 'single') return '100% into one experience'
  if (split.mode === 'audience') {
    const segs = split.branches.filter((b) => b.role === 'segment').length
    return `${segs} sub-audience${segs === 1 ? '' : 's'} + fallback`
  }
  const variants = split.branches.filter((b) => b.node.kind === 'flow').length
  return `${variants} experience${variants === 1 ? '' : 's'}`
}

function flowSubtitle(flow: FlowNode, exp: Experience | null): string {
  if (flow.target === 'HOSTED_PAGE' || (flow.target === 'PRICING_PAGE' && isExperienceTarget(flow.target, exp))) {
    return 'Acquisition'
  }
  if (isExperienceTarget(flow.target, exp)) return 'Cancel experience'
  if (flow.target === 'OFFER') return 'Save offer'
  if (flow.target === 'PRICING_PAGE') return 'Pricing table'
  return 'Treatment'
}

function branchKicker(branch: RoutingBranch, mode: SplitMode): string {
  if (branch.node.kind === 'holdout') return `Holdout · ${Math.round(branch.percent)}%`
  if (mode === 'audience') return branch.role === 'fallback' ? 'Fallback' : 'Sub-audience'
  if (mode === 'percent') {
    const role = branch.role === 'control' ? 'Control' : 'Variant'
    return `${role} · ${Math.round(branch.percent)}%`
  }
  return 'Cancel experience'
}

export interface BuildFlowGraphInput {
  play: Play
  experiences: Record<string, Experience>
  collapsedFlows: Record<string, boolean>
  selectedNodeId: string | null
  /** Educational demo in the empty enclosure — hide Traffic / A/B. */
  emptyDemo?: boolean
}

export interface BuildFlowGraphResult {
  nodes: Node[]
  edges: Edge[]
  flowLayouts: FlowBranchLayout[]
  branchNodes: (PlacedNodeMeta & { x: number; y: number })[]
  laneBottom: number
  mode: SplitMode
  split: SplitNode | null
}

interface Row {
  branch: RoutingBranch
  flow: FlowNode | null
  exp: Experience | null
  collapsed: boolean
  grid: EnclosureGrid | null
  w: number
  h: number
  rowH: number
}

/**
 * Builds the React Flow graph from a play. Trigger, audience and targeting are
 * meta configuration and deliberately absent — the canvas shows only the
 * experiences a subscriber would actually see.
 *
 * Neither zoom nor focus is an input. Every size here comes from `canvasTokens`,
 * so the graph is identical at 20% and at 160%; and focus mode is an overlay
 * rather than a canvas state, so nothing here changes when a card is opened.
 * Between them, that is the whole of "zooming cannot trigger a relayout".
 */
export function buildFlowGraph(input: BuildFlowGraphInput): BuildFlowGraphResult {
  const { play, experiences, collapsedFlows, selectedNodeId, emptyDemo } = input
  const split = play.targeting.kind === 'split' ? (play.targeting as SplitNode) : null
  const mode: SplitMode = split?.mode ?? 'single'

  const nodes: Node[] = []
  const edges: Edge[] = []
  const flowLayouts: FlowBranchLayout[] = []
  const branchNodes: (PlacedNodeMeta & { x: number; y: number })[] = []
  const sx = colX(0)
  const bx = colX(1)

  if (!split) {
    return {
      nodes,
      edges,
      flowLayouts,
      branchNodes,
      laneBottom: Y_MID + CARD_H / 2,
      mode,
      split,
    }
  }

  const rows: Row[] = split.branches.map((branch) => {
    const node = branch.node
    if (node.kind !== 'flow') {
      return { branch, flow: null, exp: null, collapsed: false, grid: null, w: 0, h: 0, rowH: CARD_H }
    }
    const flow = node
    const exp = experiences[flow.experienceId] ?? null
    const isExpTarget = isExperienceTarget(flow.target, exp)
    const collapsed = isExpTarget && !!collapsedFlows[flow.id]

    let grid: EnclosureGrid | null = null
    let w: number
    let h: number
    if (!isExpTarget) {
      w = TARGET_W
      h = TARGET_H
    } else if (collapsed || !exp) {
      // A collapsed enclosure is a fixed card whose contents adapt to the room
      // they have, rather than a box that grows with the step count.
      w = COLLAPSED_W
      h = COLLAPSED_H
    } else {
      grid = enclosureGrid(exp.steps)
      w = grid.w
      h = grid.h
    }
    if (emptyDemo && isExpTarget) {
      grid = null
      w = DEMO_ENCLOSURE_W
      h = DEMO_ENCLOSURE_H
    }
    const footer = emptyDemo && isExpTarget ? DEMO_FOOTER_ALLOWANCE : 0
    return { branch, flow, exp, collapsed, grid, w, h, rowH: TITLE_ALLOWANCE + h + footer }
  })

  const totalH = rows.reduce((s, r) => s + r.rowH, 0) + Math.max(0, rows.length - 1) * ROW_GAP
  let cursor = Y_MID - totalH / 2

  /**
   * Whether a row gets a branch card of its own.
   *
   * A branch card is there to tell one branch from another — its share of
   * traffic, its segment, whether it is the fallback. With a single branch there
   * is nothing to tell apart, and the card said "cancel experience" three times
   * over while the traffic card beside it and the enclosure title after it said
   * the same thing again. So one branch means one card, wired straight into the
   * experience; the moment there are two, each gets its own card back.
   */
  const oneBranch = rows.length === 1
  const hasBranchCard = (r: Row) => !oneBranch || !r.flow

  /** What the traffic card wires to, and the centres it is aligned on. */
  const wireTargets: string[] = []
  const anchors: number[] = []

  rows.forEach((r) => {
    const rowTop = cursor
    const branch = r.branch
    const node = branch.node
    const carded = hasBranchCard(r)

    if (r.flow) {
      const encX = emptyDemo
        ? sx
        : (carded ? bx + CARD_W : sx + CARD_W) + ENCLOSURE_GAP
      const encY = rowTop + TITLE_ALLOWANCE
      const cardY = encY + Math.max(0, (r.h - CARD_H) / 2)
      const layout: FlowBranchLayout = {
        flow: r.flow,
        branchPercent: branch.percent,
        experience: r.exp,
        collapsed: r.collapsed,
        x: encX,
        y: encY,
        w: r.w,
        h: r.h,
        grid: r.grid,
      }
      flowLayouts.push(layout)

      if (carded) {
        const placed: PlacedNodeMeta & { x: number; y: number } = {
          id: node.id,
          x: bx,
          y: cardY,
          icon: null,
          kicker: branchKicker(branch, mode),
          title: branchName(branch),
          subtitle: mode === 'audience' ? branchLabel(branch, mode) : flowSubtitle(r.flow, r.exp),
          metrics: r.flow.metrics,
          dashed: branch.role === 'fallback',
        }
        branchNodes.push(placed)

        nodes.push({
          id: node.id,
          type: 'spine',
          position: { x: bx, y: cardY },
          data: { kind: 'spine', placed, selected: selectedNodeId === node.id, isAudience: false },
          draggable: false,
          width: CARD_W,
          height: CARD_H,
        })
      }

      const isExpTarget = isExperienceTarget(r.flow.target, r.exp)
      const encId = isExpTarget ? `exp-${node.id}` : `target-${node.id}`

      nodes.push({
        id: encId,
        type: isExpTarget ? 'experience' : 'target',
        position: { x: encX, y: encY },
        data: {
          kind: isExpTarget ? 'experience' : 'target',
          layout,
          selected: selectedNodeId === r.flow.id,
        },
        draggable: false,
        width: r.w,
        height: r.h,
        zIndex: 1,
      })

      if (r.grid && r.exp) {
        pushSteps({ nodes, edges, grid: r.grid, experience: r.exp, encId })
      }

      if (carded) {
        wireTargets.push(node.id)
        anchors.push(cardY + CARD_H / 2)
        edges.push({
          id: `flow-enc-${node.id}`,
          source: node.id,
          target: encId,
          ...WIRE,
        })
      } else {
        // No card in between, so traffic wires into the experience itself.
        wireTargets.push(encId)
        anchors.push(encY + r.h / 2)
      }
    } else {
      const placed: PlacedNodeMeta & { x: number; y: number } = {
        id: node.id,
        x: bx,
        y: rowTop,
        icon: null,
        kicker: branchKicker(branch, mode),
        title: 'Control',
        subtitle: 'No treatment shown',
        metrics: node.kind === 'holdout' ? node.metrics : undefined,
      }
      branchNodes.push(placed)
      nodes.push({
        id: node.id,
        type: 'spine',
        position: { x: bx, y: rowTop },
        data: { kind: 'spine', placed, selected: selectedNodeId === node.id, isAudience: false },
        draggable: false,
        width: CARD_W,
        height: CARD_H,
      })
      wireTargets.push(node.id)
      anchors.push(rowTop + CARD_H / 2)
    }
    cursor = rowTop + r.rowH + ROW_GAP
  })

  const laneBottom = cursor - ROW_GAP

  if (emptyDemo) {
    return { nodes, edges, flowLayouts, branchNodes, laneBottom, mode, split }
  }

  // Centred on whatever it wires into rather than on the rows, whose heights
  // are driven by the enclosures: this keeps the fan-out symmetric, and lines
  // the card up exactly with its one destination when there is only one.
  const splitY = anchors.length
    ? (Math.min(...anchors) + Math.max(...anchors)) / 2 - CARD_H / 2
    : Y_MID - CARD_H / 2

  nodes.push({
    id: split.id,
    type: 'splitCard',
    position: { x: sx, y: splitY },
    data: {
      kind: 'splitCard',
      placed: {
        id: split.id,
        icon: null,
        kicker: experimentKicker(split),
        // Named from the mode, not from `split.name`: the card's job changes
        // when the mode does, and a name pinned at seed time cannot follow it.
        title: experimentTitle(split),
        subtitle: splitSummary(split),
      },
      mode,
      splitId: split.id,
    },
    draggable: false,
    width: CARD_W,
    height: CARD_H,
  })

  wireTargets.forEach((target) => {
    edges.push({
      id: `split-${target}`,
      source: split.id,
      target,
      ...WIRE,
    })
  })

  // Under the split rather than under the last branch: it adds a branch *to the
  // split*, and the split's column is empty below it at every zoom, so the
  // button never has to compete with an enclosure for room.
  nodes.push({
    id: 'add-branch',
    type: 'addBranch',
    position: { x: sx, y: splitY + CARD_H + 20 },
    data: { kind: 'addBranch', mode, splitId: split.id },
    draggable: false,
    width: CARD_W,
    height: ADD_BRANCH_H,
  })

  return { nodes, edges, flowLayouts, branchNodes, laneBottom, mode, split }
}

export const stepNodeId = (encId: string, stepId: string) => `${encId}::${stepId}`

/**
 * Steps are first-class nodes parented to their enclosure. That is what makes
 * connectors resolve to ports instead of measured DOM rectangles: a wire ends on
 * a named handle, so re-flowing a card at a different tier cannot orphan it.
 */
function pushSteps({
  nodes,
  edges,
  grid,
  experience,
  encId,
}: {
  nodes: Node[]
  edges: Edge[]
  grid: EnclosureGrid
  experience: Experience
  encId: string
}) {
  grid.slots.forEach((slot) => {
    nodes.push({
      id: stepNodeId(encId, slot.step.id),
      type: 'step',
      parentId: encId,
      position: { x: slot.x, y: slot.y },
      data: { kind: 'step', slot, experienceId: experience.id },
      draggable: false,
      width: STEP_W,
      height: STEP_H,
      zIndex: 2,
    })
  })

  // Where each offer lives, so a reason can be wired to the card that carries
  // the offer it routes to.
  const stepOfOffer = new Map<string, string>()
  grid.slots.forEach(({ step }) => {
    step.components.forEach((c) => {
      if (c.kind === 'offer') stepOfOffer.set(c.id, step.id)
    })
  })

  const routed = mappingEdges({ edges, grid, experience, encId, stepOfOffer })

  journeyEdges({ edges, grid, encId, routed })
}

/* ─────────────────────────── The journey's wires ──────────────────────── */

type StepRole = 'survey' | 'offer' | 'pricing' | 'checkout' | 'confirmation' | 'outcome' | 'plain'

function stepRole(step: Step): StepRole {
  const kinds = step.components.map((c) => c.kind)
  if (kinds.includes('confirmation')) return 'confirmation'
  if (kinds.length && kinds.every((k) => k === 'outcome')) return 'outcome'
  if (kinds.includes('checkout')) return 'checkout'
  if (kinds.length && kinds.every((k) => k === 'offer')) return 'offer'
  if (kinds.includes('pricing_table')) return 'pricing'
  if (kinds.includes('survey')) return 'survey'
  return 'plain'
}

/** Does this survey leave anyone unrouted — an "other", or a reason with no offer? */
function hasUnroutedReason(step: Step): boolean {
  const survey = step.components.find((c) => c.kind === 'survey')
  if (!survey || survey.kind !== 'survey') return true
  return survey.options.some((o) => !o.linkedOfferId)
}

/**
 * What moves a subscriber from one card to the next.
 *
 * This replaces a fan-out that wired every step in a column to every step in
 * the next one. That drawing was true of the *order* of the steps and of
 * nothing else: it said an offer leads to the confirmation, when accepting the
 * offer is the one path that never reaches it. So each wire here is a decision
 * — accepted, declined, confirmed, kept, or no offer matched the reason — and
 * lands on the card that decision actually leads to, which is how accepting
 * ends up at the saved terminal three columns along.
 *
 * `routed` is the reason→offer wires already drawn; they carry their own event,
 * so the survey does not also claim a plain path into the offers.
 */
function journeyEdges({
  edges,
  grid,
  encId,
  routed,
}: {
  edges: Edge[]
  grid: EnclosureGrid
  encId: string
  routed: Set<string>
}) {
  const roleOfCol = grid.columns.map((c) => stepRole(c.steps[0].step))
  const terminal = (want: 'saved' | 'cancelled') =>
    grid.slots.find(({ step }) =>
      step.components.some((c) => c.kind === 'outcome' && c.forResult === want),
    )?.step
  const saved = terminal('saved')
  const cancelled = terminal('cancelled')

  /** The next card the subscriber walks to — never a terminal, never a sibling. */
  const onward = (from: number, opts: { skipOffers?: boolean } = {}) => {
    for (let i = from + 1; i < grid.columns.length; i++) {
      if (roleOfCol[i] === 'outcome') continue
      if (opts.skipOffers && roleOfCol[i] === 'offer') continue
      return grid.columns[i].steps.map(({ step }) => step)
    }
    return []
  }

  const findRole = (from: number, role: StepRole) => {
    for (let i = from + 1; i < grid.columns.length; i++) {
      if (roleOfCol[i] === role) return grid.columns[i].steps[0]?.step
    }
    return undefined
  }

  /**
   * `row` is which card in a stack the wire leaves from, and it decides how far
   * out the orthogonal turn is made: without it, three variants declining into
   * the same confirmation lay their vertical runs on top of each other and
   * three routes read as one.
   *
   * The saved path curves instead of turning. It is the one wire that skips a
   * column, and an arc says so — where a right-angle turn would look like the
   * structure it is deliberately not part of.
   */
  const wire = (
    from: Step,
    to: Step | undefined,
    event: PlayEventId,
    opts: {
      handle?: 'out.right' | 'out.saved'
      curve?: 'bezier' | 'smoothstep'
      row?: number
      /** Drawn, but unlabelled — the column's label is on the first row. */
      quiet?: boolean
    } = {},
  ) => {
    if (!to || to.id === from.id) return
    edges.push({
      // Namespaced by the enclosure, like the node ids: a duplicated experience
      // keeps its step ids, so two branches of an A/B test would otherwise
      // claim the same edge id and React Flow would drop one of the two.
      id: `flow:${encId}:${from.id}->${to.id}:${event}`,
      source: stepNodeId(encId, from.id),
      target: stepNodeId(encId, to.id),
      sourceHandle: opts.handle ?? 'out.right',
      targetHandle: 'in.left',
      ...STEP_WIRE,
      data: {
        event: opts.quiet ? undefined : eventText(event),
        curve: opts.curve ?? 'smoothstep',
        offset: TURN_OFFSET + (opts.row ?? 0) * TURN_PITCH,
      },
    })
  }

  grid.columns.forEach((col, index) => {
    col.steps.forEach(({ step }, row) => {
      switch (stepRole(step)) {
        case 'outcome':
          break
        case 'confirmation':
          wire(step, cancelled, 'cancel_confirmed')
          wire(step, saved, 'subscription_kept', { handle: 'out.saved', curve: 'bezier' })
          break
        case 'offer': {
          const quiet = row > 0
          wire(step, saved, 'offer_accepted', { handle: 'out.saved', curve: 'bezier', quiet })
          onward(index).forEach((to) => wire(step, to, 'offer_declined', { row, quiet }))
          break
        }
        case 'pricing': {
          const quiet = row > 0
          const next = onward(index)
          const checkout = findRole(index, 'checkout')
          const confirm = findRole(index, 'confirmation')
          if (checkout) {
            wire(step, checkout, 'plan_selected', { quiet })
            if (confirm) wire(step, confirm, 'offer_declined', { row, quiet })
            else {
              next
                .filter((s) => stepRole(s) !== 'checkout')
                .forEach((to) => wire(step, to, 'offer_declined', { row, quiet }))
            }
          } else {
            wire(step, saved, 'plan_selected', { handle: 'out.saved', curve: 'bezier', quiet })
            next.forEach((to) => wire(step, to, 'offer_declined', { row, quiet }))
          }
          break
        }
        case 'checkout': {
          wire(step, saved, 'checkout_completed', { handle: 'out.saved', curve: 'bezier' })
          const confirm = findRole(index, 'confirmation')
          if (confirm) wire(step, confirm, 'checkout_aborted')
          break
        }
        case 'survey': {
          // A reason with an offer already has its own wire. What is left is
          // everyone the routing does not catch, and they skip the offers.
          const anyRouted = [...routed].some((pair) => pair.startsWith(`${step.id}->`))
          if (anyRouted) {
            if (hasUnroutedReason(step)) {
              onward(index, { skipOffers: true }).forEach((to) =>
                wire(step, to, 'no_matching_offer', { row }),
              )
            }
          } else {
            onward(index).forEach((to) => wire(step, to, 'continued', { row }))
          }
          break
        }
        default:
          onward(index).forEach((to) => wire(step, to, 'continued', { row }))
      }
    })
  })
}

/** Where a wire makes its first turn, and how far apart a stack's turns are. */
const TURN_OFFSET = 26
const TURN_PITCH = 16

/**
 * Reason-to-offer connectors, drawn between declared ports.
 *
 * Every reason that routes somewhere gets a wire, including the ones the card
 * has no room to name: those leave from the bundled "+N more" port instead.
 * Nothing is dropped for want of a place to start, which is what the previous
 * DOM-measuring overlay did whenever a reason fell off the bottom of a card.
 *
 * Returns the from->to pairs it drew, so the structural pass can skip them.
 */
function mappingEdges({
  edges,
  grid,
  experience,
  encId,
  stepOfOffer,
}: {
  edges: Edge[]
  grid: EnclosureGrid
  experience: Experience
  encId: string
  stepOfOffer: Map<string, string>
}): Set<string> {
  const drawn = new Set<string>()
  const colorFor = colorForOfferFactory(experience)

  grid.slots.forEach(({ step }) => {
    const rows = portRows(step)
    if (!rows.some((r) => r.kind === 'reason' || r.kind === 'overflow')) return

    // One wire per (port, offer): a bundled port carrying three reasons that all
    // route to the same offer is one relationship, not three overlapping lines.
    const seen = new Set<string>()
    const link = (
      portId: string,
      offerId: string,
      opts: { event: { label: string; short: string }; optionId?: string },
    ) => {
      const targetStepId = stepOfOffer.get(offerId)
      if (!targetStepId) return
      const key = `${portId}->${offerId}`
      if (seen.has(key)) return
      seen.add(key)
      drawn.add(`${step.id}->${targetStepId}`)
      edges.push({
        id: `map:${encId}:${step.id}:${key}`,
        source: stepNodeId(encId, step.id),
        target: stepNodeId(encId, targetStepId),
        sourceHandle: portId,
        targetHandle: offerPortId(offerId),
        type: 'journey',
        className: 'mapping-link',
        style: { stroke: colorFor(offerId) },
        data: {
          kind: 'mapping',
          curve: 'bezier',
          // The event, with the reason in it: "It's too expensive" selected.
          event: opts.event,
          // A single reason's wire is editable in place; a bundled one is not,
          // since it stands for several routes at once.
          ...(opts.optionId ? { expId: experience.id, optId: opts.optionId } : {}),
        },
      })
    }

    rows.forEach((row) => {
      if (row.kind === 'reason' && row.linkedOfferId) {
        link(row.id, row.linkedOfferId, {
          event: reasonEventText(row.label),
          optionId: row.id.slice('reason:'.length),
        })
      }
      if (row.kind === 'overflow') {
        const byOffer = new Map<string, SurveyReasonOption[]>()
        ;(row.bundled ?? []).forEach((o) => {
          if (!o.linkedOfferId) return
          byOffer.set(o.linkedOfferId, [...(byOffer.get(o.linkedOfferId) ?? []), o])
        })
        byOffer.forEach((options, offerId) =>
          link(row.id, offerId, {
            event: reasonEventText(strip(options[0].label), options.length),
            optionId: options.length === 1 ? options[0].id : undefined,
          }),
        )
      }
    })
  })

  return drawn
}
