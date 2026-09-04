import { create } from 'zustand'
import { seedExperience } from '../lib/blueprints'
import { cloneExperience } from '../lib/experienceUtils'
import { canAddToStep, countKind, hasCapRoom } from '../lib/guardrails'
import { uid } from '../lib/id'
import { complementaryVariant, laVariantPatch, usedLAVariants } from '../lib/laVariants'
import { OFFER_VARIANTS, offerVariantPatch } from '../lib/offerVariants'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import {
  makeLossAversion,
  makeOffer,
  makePricingTable,
  makeSurvey,
} from '../lib/factories'
import { COMPONENT_CAPS } from '../types/experience'
import type {
  Branding,
  BlueprintId,
  ComponentKind,
  Experience,
  ExperienceComponent,
  FrameVisibility,
  ShellLayout,
  Step,
} from '../types/experience'

/** Step kinds that a merchant can add as a brand-new card on the canvas. */
export type AddableStepKind = 'loss_aversion' | 'survey' | 'offer' | 'pricing_table'

export type AppMode = 'compose' | 'play'
export type DeviceKind = 'desktop' | 'tablet' | 'mobile'
export type PlayResult = 'cancelled' | 'saved' | 'kept'

export interface PlaySession {
  index: number
  selectedReasonId: string | null
  reasonText: Record<string, string>
  acceptedOfferId: string | null
  checkout: { open: boolean; offerId: string | null }
  result: PlayResult | null
  undone: boolean
  confirmInput: string
  consentChecked: boolean
  feedback: string
}

function freshSession(): PlaySession {
  return {
    index: 0,
    selectedReasonId: null,
    reasonText: {},
    acceptedOfferId: null,
    checkout: { open: false, offerId: null },
    result: null,
    undone: false,
    confirmInput: '',
    consentChecked: false,
    feedback: '',
  }
}

export function activeExperience(state: Pick<ExperienceState, 'experiences' | 'activeExperienceId'>): Experience {
  return state.experiences[state.activeExperienceId]
}

export interface ExperienceState {
  experiences: Record<string, Experience>
  activeExperienceId: string
  experience: Experience
  mode: AppMode
  device: DeviceKind
  activeStepId: string
  session: PlaySession

  setActiveExperience: (id: string) => void
  renameExperience: (id: string, name: string) => void
  duplicateExperience: (sourceId: string, name?: string) => string
  listExperiences: () => Experience[]

  setMode: (mode: AppMode) => void
  setDevice: (device: DeviceKind) => void
  selectBlueprint: (id: BlueprintId) => void
  /** Replace the active experience's steps wholesale (agent-composed plans). */
  installSteps: (blueprint: BlueprintId, steps: Step[]) => void
  /** Replace the active experience wholesale (compiled from the journey file). */
  replaceActiveExperience: (exp: Experience) => void
  setActiveStep: (stepId: string) => void

  setShell: (shell: ShellLayout) => void
  updateBranding: (patch: Partial<Branding>) => void
  updateFrame: (patch: Partial<FrameVisibility>) => void
  reorderSteps: (fromId: string, toId: string) => void
  setStepDisabled: (stepId: string, disabled: boolean) => void
  /**
   * Insert a step. `at` says where relative to an existing step; without it the
   * step lands at the end of the authored flow, before the locked tail.
   */
  addStep: (
    kind: AddableStepKind,
    at?: { after?: string; before?: string },
  ) => { ok: boolean; reason?: string }
  removeStep: (stepId: string) => void

  updateStep: (stepId: string, patch: Partial<Step>) => void
  updateComponent: (
    stepId: string,
    componentId: string,
    patch: Partial<ExperienceComponent>,
  ) => void
  addComponent: (stepId: string, kind: ComponentKind) => { ok: boolean; reason?: string }
  removeComponent: (stepId: string, componentId: string) => void
  swapStepComponents: (stepId: string) => void

  startPlay: () => void
  goNext: () => void
  goBack: () => void
  goToIndex: (index: number) => void
  selectReason: (reasonId: string | null) => void
  setReasonText: (key: string, value: string) => void
  acceptOffer: (offerId: string) => void
  declineOffer: () => void
  completeCheckout: () => void
  cancelCheckout: () => void
  confirmCancel: () => void
  keepSubscription: () => void
  setConfirmInput: (value: string) => void
  setConsent: (checked: boolean) => void
  setFeedback: (value: string) => void
  undoCancel: () => void
  resetSession: () => void
}

function makeComponent(kind: ComponentKind): ExperienceComponent | null {
  switch (kind) {
    case 'loss_aversion':
      return makeLossAversion()
    case 'survey':
      return makeSurvey()
    case 'offer':
      return makeOffer()
    case 'pricing_table':
      return makePricingTable()
    default:
      return null
  }
}

/** Confirmation + outcome are the locked tail — never moved or deleted. */
function isTailStep(step: Step): boolean {
  return step.components.some((c) => c.kind === 'confirmation' || c.kind === 'outcome')
}

/** Build a fresh standalone step for a merchant-added card. */
function makeAddableStep(kind: AddableStepKind, existing: Experience): Step {
  const base = { id: uid('step'), layout: 'single' as const }
  switch (kind) {
    case 'offer': {
      // Default to a variant not already used, so consecutive adds differ.
      const used = new Set(
        existing.steps
          .flatMap((s) => s.components)
          .filter((c) => c.kind === 'offer')
          .map((c) => c.category),
      )
      const variant = OFFER_VARIANTS.find((v) => !used.has(v.category)) ?? OFFER_VARIANTS[0]
      return {
        ...base,
        stage: 'save_mechanic',
        title: '',
        description: '',
        components: [
          makeOffer({ reasonLinked: true, media: { type: 'image' }, ...offerVariantPatch(variant.category) }),
        ],
      }
    }
    case 'survey':
      return {
        ...base,
        stage: 'route_detection',
        title: 'Help us improve — why are you cancelling?',
        description: 'Your feedback shapes what we build next.',
        components: [makeSurvey()],
      }
    case 'loss_aversion':
      return {
        ...base,
        stage: 'value_reinforcement',
        title: 'Before you go',
        description: '',
        components: [makeLossAversion()],
      }
    case 'pricing_table':
      return {
        ...base,
        stage: 'save_mechanic',
        title: 'A plan that fits better',
        description: '',
        components: [makePricingTable()],
      }
  }
}

function mapStep(experience: Experience, stepId: string, fn: (step: Step) => Step): Experience {
  return {
    ...experience,
    steps: experience.steps.map((s) => (s.id === stepId ? fn(s) : s)),
  }
}

function normalizeOfferMedia(step: Step): Step {
  const offerCount = step.components.filter((c) => c.kind === 'offer').length
  if (offerCount === 0) return step
  const paired = offerCount >= 2
  return {
    ...step,
    components: step.components.map((c) => {
      if (c.kind !== 'offer') return c
      if (paired) return c.media ? { ...c, media: null } : c
      return c.media ? c : { ...c, media: { type: 'image' as const }, mediaSide: c.mediaSide ?? 'right' }
    }),
  }
}

function patchActive(
  state: ExperienceState,
  fn: (exp: Experience) => Experience,
): Partial<ExperienceState> {
  const current = state.experiences[state.activeExperienceId]
  const next = fn(current)
  return {
    experiences: { ...state.experiences, [state.activeExperienceId]: next },
    experience: next,
  }
}

function patchExperienceById(
  state: ExperienceState,
  id: string,
  fn: (exp: Experience) => Experience,
): Partial<ExperienceState> {
  const current = state.experiences[id]
  if (!current) return {}
  const next = fn(current)
  const patch: Partial<ExperienceState> = {
    experiences: { ...state.experiences, [id]: next },
  }
  if (id === state.activeExperienceId) patch.experience = next
  return patch
}

const primary: Experience = {
  ...seedExperience('balanced', {
    id: PRIMARY_EXPERIENCE_ID,
    name: 'Untitled journey',
  }),
  steps: [],
}

export const useExperience = create<ExperienceState>((set, get) => ({
  experiences: { [PRIMARY_EXPERIENCE_ID]: primary },
  activeExperienceId: PRIMARY_EXPERIENCE_ID,
  experience: primary,
  mode: 'compose',
  device: 'desktop',
  activeStepId: '',
  session: freshSession(),

  setActiveExperience: (id) =>
    set((state) => {
      const exp = state.experiences[id]
      if (!exp) return {}
      return {
        activeExperienceId: id,
        experience: exp,
        activeStepId: exp.steps[0]?.id ?? state.activeStepId,
        session: freshSession(),
      }
    }),

  renameExperience: (id, name) =>
    set((state) => patchExperienceById(state, id, (exp) => ({ ...exp, name }))),

  duplicateExperience: (sourceId, name) => {
    const source = get().experiences[sourceId]
    if (!source) return sourceId
    const copy = cloneExperience(source, { name: name ?? `${source.name} (copy)` })
    set((state) => ({
      experiences: { ...state.experiences, [copy.id]: copy },
    }))
    return copy.id
  },

  listExperiences: () => Object.values(get().experiences),

  setMode: (mode) =>
    set((state) => ({
      mode,
      session: mode === 'play' ? freshSession() : state.session,
    })),
  setDevice: (device) => set({ device }),

  selectBlueprint: (id) => {
    set((state) => {
      const shell = state.experience.shell
      const next = seedExperience(id, { id: state.activeExperienceId, name: state.experience.name })
      next.shell = shell
      return {
        ...patchExperienceById(state, state.activeExperienceId, () => next),
        activeStepId: next.steps[0].id,
        session: freshSession(),
      }
    })
  },

  installSteps: (blueprint, steps) => {
    set((state) => ({
      ...patchExperienceById(state, state.activeExperienceId, (exp) => ({ ...exp, blueprint, steps })),
      activeStepId: steps[0]?.id ?? '',
      session: freshSession(),
    }))
  },

  replaceActiveExperience: (exp) =>
    set((state) => ({
      experiences: { ...state.experiences, [exp.id]: exp },
      activeExperienceId: exp.id,
      experience: exp,
      activeStepId: exp.steps.find((s) => !s.disabled)?.id ?? exp.steps[0]?.id ?? '',
      session: freshSession(),
    })),

  setActiveStep: (stepId) => set({ activeStepId: stepId }),

  setShell: (shell) => set((state) => patchActive(state, (exp) => ({ ...exp, shell }))),

  reorderSteps: (fromId, toId) =>
    set((state) =>
      patchActive(state, (exp) => {
        const isTail = (s: Step) =>
          s.components.some((c) => c.kind === 'confirmation' || c.kind === 'outcome')
        const steps = [...exp.steps]
        const from = steps.findIndex((s) => s.id === fromId)
        if (from === -1 || fromId === toId) return exp
        if (isTail(steps[from])) return exp
        const [moved] = steps.splice(from, 1)
        const to = steps.findIndex((s) => s.id === toId)
        steps.splice(to === -1 ? steps.length : to, 0, moved)
        // The tail is put back last, whatever the drop did. Plural on both
        // counts: an outcome per result, and one confirmation ahead of them.
        const conf = steps.filter((s) => s.components.some((c) => c.kind === 'confirmation'))
        const outcomes = steps.filter((s) => s.components.some((c) => c.kind === 'outcome'))
        const tail = new Set([...conf, ...outcomes])
        const rest = steps.filter((s) => !tail.has(s))
        return { ...exp, steps: [...rest, ...conf, ...outcomes] }
      }),
    ),

  setStepDisabled: (stepId, disabled) =>
    set((state) =>
      patchActive(state, (exp) => {
        const target = exp.steps.find((s) => s.id === stepId)
        // Tail steps (confirmation / outcome) are required — never disable them.
        if (!target || isTailStep(target)) return exp
        return {
          ...exp,
          steps: exp.steps.map((s) => (s.id === stepId ? { ...s, disabled } : s)),
        }
      }),
    ),

  addStep: (kind, at) => {
    const exp = get().experience
    const cap = (COMPONENT_CAPS as Record<string, number | undefined>)[kind]
    if (cap !== undefined && countKind(exp, kind) >= cap) {
      const label = kind.replace(/_/g, ' ')
      return { ok: false, reason: `You’ve reached the limit of ${cap} ${label} cards.` }
    }
    const step = makeAddableStep(kind, exp)
    set((state) =>
      patchActive(state, (e) => {
        const steps = [...e.steps]
        const tailIdx = steps.findIndex(isTailStep)
        const beforeTail = tailIdx === -1 ? steps.length : tailIdx
        let insertAt = beforeTail
        if (at?.after) {
          const ai = steps.findIndex((s) => s.id === at.after)
          if (ai !== -1) insertAt = Math.min(ai + 1, beforeTail)
        } else if (at?.before) {
          const bi = steps.findIndex((s) => s.id === at.before)
          if (bi !== -1) insertAt = Math.min(bi, beforeTail)
        }
        steps.splice(insertAt, 0, step)
        return { ...e, steps }
      }),
    )
    return { ok: true }
  },

  removeStep: (stepId) =>
    set((state) =>
      patchActive(state, (exp) => {
        const target = exp.steps.find((s) => s.id === stepId)
        if (!target || isTailStep(target)) return exp
        const removedOfferIds = new Set(
          target.components.filter((c) => c.kind === 'offer').map((c) => c.id),
        )
        let steps = exp.steps.filter((s) => s.id !== stepId)
        if (removedOfferIds.size) {
          // Drop dangling reason→offer links pointing at the deleted offers.
          steps = steps.map((s) => ({
            ...s,
            components: s.components.map((c) =>
              c.kind === 'survey'
                ? {
                    ...c,
                    options: c.options.map((o) =>
                      o.linkedOfferId && removedOfferIds.has(o.linkedOfferId)
                        ? { ...o, linkedOfferId: null }
                        : o,
                    ),
                  }
                : c,
            ),
          }))
        }
        return { ...exp, steps }
      }),
    ),

  updateBranding: (patch) =>
    set((state) =>
      patchActive(state, (exp) => ({
        ...exp,
        branding: { ...exp.branding, ...patch },
      })),
    ),

  updateFrame: (patch) =>
    set((state) =>
      patchActive(state, (exp) => ({
        ...exp,
        frame: { ...exp.frame, ...patch },
      })),
    ),

  updateStep: (stepId, patch) =>
    set((state) => patchActive(state, (exp) => mapStep(exp, stepId, (s) => ({ ...s, ...patch })))),

  updateComponent: (stepId, componentId, patch) =>
    set((state) =>
      patchActive(state, (exp) =>
        mapStep(exp, stepId, (s) => ({
          ...s,
          components: s.components.map((c) =>
            c.id === componentId ? ({ ...c, ...patch } as ExperienceComponent) : c,
          ),
        })),
      ),
    ),

  addComponent: (stepId, kind) => {
    const state = get()
    const step = state.experience.steps.find((s) => s.id === stepId)
    if (!step) return { ok: false, reason: 'Step not found.' }

    const stepCheck = canAddToStep(step, kind)
    if (!stepCheck.ok) return stepCheck

    if (!hasCapRoom(state.experience, kind)) {
      return { ok: false, reason: `You have reached the limit for this component type.` }
    }

    const component = makeComponent(kind)
    if (!component) return { ok: false, reason: 'This component cannot be added here.' }

    if (component.kind === 'loss_aversion') {
      const taken = usedLAVariants(step.components)
      const free = complementaryVariant(taken)
      if (!free) return { ok: false, reason: 'All loss-aversion variants are already used on this step.' }
      Object.assign(component, laVariantPatch(component, free))
    }

    set((s) =>
      patchActive(s, (exp) =>
        mapStep(exp, stepId, (st) =>
          normalizeOfferMedia({
            ...st,
            layout: st.components.length >= 1 ? 'two_column' : st.layout,
            components: [...st.components, component],
          }),
        ),
      ),
    )
    return { ok: true }
  },

  swapStepComponents: (stepId) =>
    set((state) =>
      patchActive(state, (exp) =>
        mapStep(exp, stepId, (s) =>
          s.components.length === 2 ? { ...s, components: [s.components[1], s.components[0]] } : s,
        ),
      ),
    ),

  removeComponent: (stepId, componentId) =>
    set((state) =>
      patchActive(state, (exp) =>
        mapStep(exp, stepId, (s) => {
          const components = s.components.filter((c) => c.id !== componentId)
          return normalizeOfferMedia({
            ...s,
            components,
            layout: components.length <= 1 ? 'single' : s.layout,
          })
        }),
      ),
    ),

  startPlay: () => set({ mode: 'play', session: freshSession() }),

  goNext: () =>
    set((state) => {
      const last = state.experience.steps.length - 1
      return { session: { ...state.session, index: Math.min(state.session.index + 1, last) } }
    }),

  goBack: () =>
    set((state) => ({
      session: { ...state.session, index: Math.max(state.session.index - 1, 0) },
    })),

  goToIndex: (index) =>
    set((state) => {
      const last = state.experience.steps.length - 1
      return { session: { ...state.session, index: Math.max(0, Math.min(index, last)) } }
    }),

  selectReason: (reasonId) =>
    set((state) => ({ session: { ...state.session, selectedReasonId: reasonId ?? null } })),

  setReasonText: (key, value) =>
    set((state) => ({
      session: { ...state.session, reasonText: { ...state.session.reasonText, [key]: value } },
    })),

  acceptOffer: (offerId) =>
    set((state) => {
      const live = state.experience.steps.filter((s) => !s.disabled)
      const checkoutIdx = live.findIndex((s) => s.components.some((c) => c.kind === 'checkout'))
      const component = state.experience.steps
        .flatMap((s) => s.components)
        .find((c) => c.id === offerId)
      if (checkoutIdx >= 0) {
        return {
          session: {
            ...state.session,
            acceptedOfferId: offerId,
            index: checkoutIdx,
            checkout: { open: false, offerId },
          },
        }
      }
      const altersBilling =
        component?.kind === 'pricing_table' ||
        (component?.kind === 'offer' &&
          (component.fulfillment === 'checkout' ||
            ['discount', 'plan_change', 'addon', 'one_time_charge'].includes(component.category)))
      if (altersBilling) {
        return {
          session: {
            ...state.session,
            acceptedOfferId: offerId,
            checkout: { open: true, offerId },
          },
        }
      }
      return {
        session: { ...state.session, acceptedOfferId: offerId, result: 'saved' },
      }
    }),

  declineOffer: () => {
    get().goNext()
  },

  completeCheckout: () =>
    set((state) => ({
      session: { ...state.session, checkout: { open: false, offerId: null }, result: 'saved' },
    })),

  cancelCheckout: () =>
    set((state) => ({
      session: { ...state.session, checkout: { open: false, offerId: null } },
    })),

  confirmCancel: () => set((state) => ({ session: { ...state.session, result: 'cancelled' } })),

  keepSubscription: () => set((state) => ({ session: { ...state.session, result: 'kept' } })),

  setConfirmInput: (value) =>
    set((state) => ({ session: { ...state.session, confirmInput: value } })),

  setConsent: (checked) =>
    set((state) => ({ session: { ...state.session, consentChecked: checked } })),

  setFeedback: (value) => set((state) => ({ session: { ...state.session, feedback: value } })),

  undoCancel: () => set((state) => ({ session: { ...state.session, undone: true } })),

  resetSession: () => set({ session: freshSession() }),
}))
