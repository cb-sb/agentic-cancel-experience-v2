import { create } from 'zustand'
import { blueprintMeta } from '../../lib/blueprints'
import { useExperience } from '../../store/useExperience'
import type { AnnotationTarget } from '../../store/useOrchestration'
import { annotateReply } from './annotate'
import { useCopilotThread } from '../copilotThread'
import { applyOps, isExperienceDirty } from './apply'
import { TURNS, pathwayOf } from './flows'
import { ENTRY_TURN_ID, GAP_TURN_ID, PLAN_CARD_TURN_ID, PLAN_TURN_ID, PUSHBACK_TURN_ID } from './ids'
import { looksLikeBrief, mergeIntake, parseIntake } from './intake'
import { emptyIntent, nextGap, unrealistic } from './intent'
import { buildPlan, swapOffer } from './planner'
import { stepDown, stepUp } from './recommend'
import type { BlueprintId, ReasonCode } from '../../types/experience'
import type {
  ApplyOp,
  AssistantOption,
  AssistantTurn,
  ChatMessage,
  FlowContext,
  PendingConfirm,
} from './types'

export function resolveMessage(turn: AssistantTurn, ctx: FlowContext): string {
  return typeof turn.message === 'function' ? turn.message(ctx) : turn.message
}

export function resolveOptions(turn: AssistantTurn, ctx: FlowContext): AssistantOption[] {
  return typeof turn.options === 'function' ? turn.options(ctx) : turn.options
}

const initialCtx: FlowContext = {
  pathwayId: null,
  phase: 'entry',
  currentTurnId: ENTRY_TURN_ID,
  signals: {},
  recommendedBlueprintId: null,
  intent: emptyIntent(),
  currentGap: null,
  plan: null,
  pushback: null,
}

interface AssistantState {
  messages: ChatMessage[]
  ctx: FlowContext
  pending: PendingConfirm | null
  /** When true, the transcript is shown regardless of the guided view (annotation thread). */
  threadOpen: boolean
  selectOption: (optionId: string) => void
  submitText: (text: string) => void
  confirmApply: () => void
  cancelConfirm: () => void
  /** Install a template picked in the library modal, then review the plan. */
  applyTemplate: (id: BlueprintId) => void
  configure: () => void
  goHome: () => void
  /** Push a canvas annotation into the main chat and reply. */
  submitAnnotation: (target: AnnotationTarget, text: string) => void
  /** Run a message's attached Apply action and mark it applied. */
  applyMessageAction: (messageId: number) => void
  /** Leave the annotation thread and return to the guided view. */
  closeThread: () => void
  /** Re-map one reason to a different offer on the drafted plan. */
  swapPlanOffer: (code: ReasonCode, offerId: string | null) => void
  /** Install the drafted plan on the stores. */
  buildPlanNow: () => void
  /** Reopen the conversation to refine the drafted plan. */
  adjustPlan: () => void
  reset: () => void
}

/** Sentinel turn ids rendered as bespoke panels (not chat turns). */
const PANEL_TURNS = new Set([PLAN_CARD_TURN_ID, 'PLAN', 'DONE'])

/** Phase each panel sentinel maps onto. */
const PANEL_PHASE: Record<string, FlowContext['phase']> = {
  [PLAN_CARD_TURN_ID]: 'plan',
  PLAN: 'plan',
  DONE: 'done',
}

let msgId = 1

function greet(): ChatMessage[] {
  const entry = TURNS[ENTRY_TURN_ID]
  return [{ id: 0, role: 'assistant', text: resolveMessage(entry, initialCtx) }]
}

export const useAssistant = create<AssistantState>((set, get) => {
  /** Enter a turn: run onEnter, push its message, update context. */
  function goTo(turnId: string, baseCtx: FlowContext): void {
    // Panel turns (plan card / plan / done) are bespoke UI, not chat bubbles.
    if (PANEL_TURNS.has(turnId)) {
      // The plan card is drafted on entry, so it always reflects the latest intent.
      const plan = turnId === PLAN_CARD_TURN_ID ? buildPlan(baseCtx.intent) : baseCtx.plan
      set({
        ctx: { ...baseCtx, currentTurnId: turnId, phase: PANEL_PHASE[turnId] ?? 'done', plan },
      })
      return
    }
    const turn = TURNS[turnId]
    if (!turn) return
    let ctx: FlowContext = { ...baseCtx }
    if (turnId === ENTRY_TURN_ID) {
      ctx = {
        ...ctx,
        signals: {},
        recommendedBlueprintId: null,
        pathwayId: null,
        intent: emptyIntent(),
        currentGap: null,
        plan: null,
        pushback: null,
      }
    }
    ctx = { ...ctx, ...(turn.onEnter?.(ctx) ?? {}) }
    ctx = {
      ...ctx,
      currentTurnId: turnId,
      phase: turn.phase,
      pathwayId: pathwayOf(turnId) ?? (turnId === ENTRY_TURN_ID ? null : ctx.pathwayId),
    }
    const text = resolveMessage(turn, ctx)
    set((s) => ({ ctx, messages: [...s.messages, { id: msgId++, role: 'assistant', text }] }))
  }

  function pushUser(text: string): void {
    set((s) => ({ messages: [...s.messages, { id: msgId++, role: 'user', text }] }))
  }

  function pushAssistant(text: string): void {
    set((s) => ({ messages: [...s.messages, { id: msgId++, role: 'assistant', text }] }))
  }

  return {
    messages: greet(),
    ctx: initialCtx,
    pending: null,
    threadOpen: false,

    selectOption: (optionId) => {
      const { ctx } = get()
      const turn = ctx.currentTurnId ? TURNS[ctx.currentTurnId] : null
      if (!turn) return
      const option = resolveOptions(turn, ctx).find((o) => o.id === optionId)
      if (!option) return

      // An option that leaves the conversation where it is — one that opens a
      // panel, say — is not an answer, so it does not belong in the transcript.
      if (option.advance !== false) pushUser(option.label)

      let next: FlowContext = { ...ctx, signals: { ...ctx.signals, ...option.setSignals } }
      if (option.setIntent) next = { ...next, intent: { ...next.intent, ...option.setIntent } }
      if (option.pickBlueprint) next = { ...next, recommendedBlueprintId: option.pickBlueprint }

      // Nudge the working recommendation and re-render the same turn.
      if (option.adjust) {
        const base = next.recommendedBlueprintId ?? 'balanced'
        const stepped = option.adjust === 'down' ? stepDown(base) : stepUp(base)
        goTo(turn.id, { ...next, recommendedBlueprintId: stepped })
        return
      }

      const ops = option.apply ?? []
      const replaces = ops.some((o) => o.t === 'blueprint')
      const nextTurn = option.resolveNext?.(next) ?? option.next ?? null

      if (option.confirmReplace && replaces && isExperienceDirty(useExperience.getState().experience)) {
        const bp = ops.find((o) => o.t === 'blueprint')
        const meta = bp && bp.t === 'blueprint' ? blueprintMeta(bp.id) : null
        set({
          ctx: next,
          pending: {
            title: 'Replace the current steps?',
            lines: [
              'This experience has edits that will be replaced by',
              meta ? `${meta.name} — ${meta.stepCount} step${meta.stepCount > 1 ? 's' : ''}.` : 'a new template.',
            ],
            apply: ops,
            next: nextTurn,
          },
        })
        return
      }

      if (ops.length) applyOps(ops)
      set({ ctx: next })
      if (option.advance !== false && nextTurn) goTo(nextTurn, next)
    },

    confirmApply: () => {
      const { pending, ctx } = get()
      if (!pending) return
      applyOps(pending.apply)
      set({ pending: null })
      if (pending.next) goTo(pending.next, ctx)
    },

    cancelConfirm: () => set({ pending: null }),

    applyTemplate: (id) => {
      const { ctx } = get()
      const meta = blueprintMeta(id)
      const ops: ApplyOp[] = [{ t: 'blueprint', id }, { t: 'focus', node: 'flow' }]
      pushUser(`Start from the ${meta.name}`)
      // The same gate the template turns use — authored steps are never
      // replaced without asking.
      if (isExperienceDirty(useExperience.getState().experience)) {
        set({
          pending: {
            title: 'Replace the current steps?',
            lines: [
              'This experience has edits that will be replaced by',
              `${meta.name} — ${meta.stepCount} step${meta.stepCount > 1 ? 's' : ''}.`,
            ],
            apply: ops,
            next: PLAN_TURN_ID,
          },
        })
        return
      }
      applyOps(ops)
      goTo(PLAN_TURN_ID, ctx)
    },

    configure: () => goTo('DONE', get().ctx),

    goHome: () => goTo(ENTRY_TURN_ID, get().ctx),

    submitAnnotation: (target, text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      set((s) => ({
        threadOpen: true,
        messages: [...s.messages, { id: msgId++, role: 'user', text: trimmed, ref: { label: target.label } }],
      }))
      const reply = annotateReply(target, trimmed)
      const assistantId = msgId
      set((s) => ({
        messages: [...s.messages, { id: msgId++, role: 'assistant', text: reply.text, action: reply.action }],
      }))
      const chat = useCopilotThread.getState()
      chat.say('you', trimmed, target.label)
      chat.say('bot', reply.text, reply.action ? { applyMessageId: assistantId } : undefined)
    },

    applyMessageAction: (messageId) => {
      const msg = get().messages.find((m) => m.id === messageId)
      if (!msg?.action || msg.action.applied) return
      applyOps(msg.action.ops)
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId && m.action ? { ...m, action: { ...m.action, applied: true } } : m,
        ),
      }))
    },

    closeThread: () => set({ threadOpen: false }),

    swapPlanOffer: (code, offerId) => {
      const { ctx } = get()
      if (!ctx.plan) return
      set({ ctx: { ...ctx, plan: swapOffer(ctx.plan, code, offerId) } })
    },

    buildPlanNow: () => {
      const { ctx } = get()
      if (!ctx.plan) return
      applyOps([{ t: 'plan', plan: ctx.plan }])
      goTo('DONE', ctx)
    },

    adjustPlan: () => {
      const { ctx } = get()
      pushAssistant('Sure — what should I change? Name a segment, a posture, a step count or an offer.')
      set({ ctx: { ...ctx, currentTurnId: GAP_TURN_ID, currentGap: null, phase: 'consult' } })
    },

    submitText: (raw) => {
      const text = raw.trim()
      if (!text) return
      pushUser(text)
      const { ctx } = get()
      const q = text.toLowerCase()

      // Explicit navigation asks win, so the shortcuts keep working mid-setup.
      if (/templat/.test(q)) {
        applyOps([{ t: 'openTemplates' }])
        return pushAssistant('Opening the template library…')
      }
      if (/preview/.test(q)) {
        applyOps([{ t: 'preview' }])
        return pushAssistant('Opening the subscriber preview…')
      }
      if (/publish|go live/.test(q)) {
        applyOps([{ t: 'publish' }])
        return pushAssistant('Toggled the publish state on the play.')
      }
      if (/^(?:recommend|guide me|ask me)/.test(q)) return goTo('A_goal', ctx)

      // Otherwise the prompt is a play brief: parse it, push back on anything
      // unbuildable, ask about the highest-priority gap, or draft straight away.
      const conversational = ctx.currentTurnId === ENTRY_TURN_ID || ctx.currentTurnId === GAP_TURN_ID
      const intent = conversational ? mergeIntake(ctx.intent, text) : parseIntake(text)
      if (!looksLikeBrief(intent)) {
        return pushAssistant(
          'Tell me what you want this flow to do — the outcome, who it is for, and how hard it should push. Or try: templates, trigger, audience, split, preview.',
        )
      }

      const withIntent: FlowContext = { ...ctx, intent, pushback: null }
      const block = unrealistic(intent)
      if (block) return goTo(PUSHBACK_TURN_ID, { ...withIntent, pushback: block })
      return goTo(nextGap(intent) ? GAP_TURN_ID : PLAN_CARD_TURN_ID, withIntent)
    },

    reset: () => {
      msgId = 1
      set({ messages: greet(), ctx: { ...initialCtx, intent: emptyIntent() }, pending: null, threadOpen: false })
    },
  }
})
