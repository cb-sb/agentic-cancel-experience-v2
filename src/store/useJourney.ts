import { create } from 'zustand'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { AUDIENCE_LIBRARY } from '../types/orchestration'
import { compileJourney } from '../journey/compile'
import { stringifyJourney, parseJourney } from '../journey/yaml'
import { parseContext } from '../journey/contextDoc'
import { journeyBrandFrom } from '../brand/theme'
import { EMPTY_JOURNEY, DEFAULT_JOURNEY_BRAND, isTailKind, type JourneyFile } from '../journey/types'
import type { Branding } from '../types/experience'
import { useExperience } from './useExperience'
import { useOrchestration } from './useOrchestration'

export type DockMode = 'prompt' | 'code'

function applyHoldout(holdout: number) {
  const orch = useOrchestration.getState()
  const targeting = orch.play.targeting
  if (targeting.kind !== 'split') return
  const splitId = targeting.id
  const clamped = Math.max(0, Math.min(50, Math.round(holdout)))
  if (clamped <= 0) {
    orch.setSplitMode(splitId, 'single')
    return
  }
  orch.setSplitMode(splitId, 'percent')
  const afterMode = useOrchestration.getState().play.targeting
  if (afterMode.kind !== 'split') return
  if (!afterMode.branches.some((b) => b.node.kind === 'holdout')) {
    orch.toggleHoldout(splitId)
  }
  const next = useOrchestration.getState().play.targeting
  if (next.kind !== 'split') return
  const flows = next.branches.filter((b) => b.node.kind === 'flow')
  const hold = next.branches.find((b) => b.node.kind === 'holdout')
  if (!hold || flows.length === 0) return
  const share = Math.round((100 - clamped) / flows.length)
  const percents: Record<string, number> = {}
  flows.forEach((b) => {
    percents[b.id] = share
  })
  percents[hold.id] = clamped
  orch.setSplitPercents(splitId, percents)
}

function pushFile(file: JourneyFile, yaml?: string): { file: JourneyFile; yaml: string; yamlError: null } {
  const compiled = compileJourney(file, PRIMARY_EXPERIENCE_ID)
  useExperience.getState().replaceActiveExperience(compiled.experience)
  const orch = useOrchestration.getState()
  orch.updatePlay(compiled.playPatch)
  if (compiled.playPatch.audience) orch.updateAudience(compiled.playPatch.audience)
  const flow = compiled.playPatch.playType === 'ACQUISITION' ? 'HOSTED_PAGE' : 'CANCEL_PAGE'
  const split = orch.play.targeting
  if (split.kind === 'split') {
    const branch = split.branches.find((b) => b.node.kind === 'flow')
    if (branch && branch.node.kind === 'flow') {
      orch.setFlowTarget(branch.node.id, flow)
      orch.updateFlowNode(branch.node.id, {
        name: file.kind === 'acquisition' ? 'Acquisition' : 'Cancel experience',
      })
    }
  }
  applyHoldout(file.holdout)
  return { file, yaml: yaml ?? stringifyJourney(file), yamlError: null }
}

interface JourneyState {
  file: JourneyFile
  yaml: string
  yamlError: string | null
  contextError: string | null
  dockMode: DockMode
  /** Canvas is a preview of the file — no add/remove chrome. */
  previewOnly: true
  setDockMode: (mode: DockMode) => void
  replaceFile: (file: JourneyFile) => void
  patchFile: (patch: Partial<JourneyFile>) => void
  setYaml: (text: string) => void
  applyContextDoc: (text: string) => void
  reorderSteps: (fromId: string, toId: string) => void
  applyBrand: (branding: Branding, matched?: boolean) => void
}

export const useJourney = create<JourneyState>((set, get) => ({
  file: EMPTY_JOURNEY,
  yaml: stringifyJourney(EMPTY_JOURNEY),
  yamlError: null,
  contextError: null,
  dockMode: 'prompt',
  previewOnly: true,

  setDockMode: (dockMode) => set({ dockMode }),

  replaceFile: (file) => set({ ...pushFile(file), contextError: null }),

  patchFile: (patch) => {
    const file = { ...get().file, ...patch }
    set({ ...pushFile(file), contextError: null })
  },

  setYaml: (text) => {
    const parsed = parseJourney(text)
    if (parsed.error || !parsed.file) {
      set({ yaml: text, yamlError: parsed.error ?? 'Could not read this file' })
      return
    }
    const current = get().file
    const file =
      parsed.file.source === 'uploaded'
        ? {
            ...parsed.file,
            artifact: parsed.file.artifact ?? current.artifact,
            manifest: parsed.file.manifest ?? current.manifest,
          }
        : parsed.file
    set({ ...pushFile(file, text), contextError: null })
  },

  applyContextDoc: (text) => {
    const parsed = parseContext(text, get().file)
    if (parsed.error) {
      set({ contextError: parsed.error })
      return
    }
    set({ ...pushFile(parsed.file), contextError: null })
  },

  applyBrand: (branding, matched) => {
    const keep = matched ?? get().file.brand.matched ?? false
    set({
      ...pushFile({ ...get().file, brand: journeyBrandFrom(branding, keep) }),
      contextError: null,
    })
  },

  reorderSteps: (fromId, toId) => {
    const file = get().file
    const steps = [...file.steps]
    const from = steps.findIndex((s) => s.id === fromId)
    const to = steps.findIndex((s) => s.id === toId)
    if (from < 0 || to < 0 || from === to) return
    if (isTailKind(steps[from].kind)) return
    const [moved] = steps.splice(from, 1)
    const dest = steps.findIndex((s) => s.id === toId)
    if (dest < 0) return
    steps.splice(dest, 0, moved)
    const tail = steps.filter((s) => isTailKind(s.kind))
    const rest = steps.filter((s) => !isTailKind(s.kind))
    set(pushFile({ ...file, steps: [...rest, ...tail] }))
  },
}))

/** Restore a saved file without going through replaceFile's yaml rewrite. */
export function restoreJourney(file: JourneyFile) {
  const hydrated: JourneyFile = {
    ...EMPTY_JOURNEY,
    ...file,
    brand: {
      ...DEFAULT_JOURNEY_BRAND,
      ...file.brand,
      theme: file.brand.theme ?? DEFAULT_JOURNEY_BRAND.theme,
    },
    holdout: file.holdout ?? 0,
    steps: file.steps ?? [],
    source: file.source ?? 'authored',
    artifact: file.artifact,
    manifest: file.manifest,
  }
  useJourney.setState(pushFile(hydrated))
}

/** Audience library lookup used by compile — re-exported so prompt copy can name them. */
export function audienceLabel(key: JourneyFile['audience']): string {
  if (key === 'all') return 'All subscribers'
  const id =
    key === 'paying'
      ? 'all_paying'
      : key === 'high_value'
        ? 'high_value'
        : key === 'high_risk'
          ? 'high_risk'
          : key === 'annual'
            ? 'annual'
            : 'in_trial'
  return AUDIENCE_LIBRARY.find((a) => a.id === id)?.name ?? key
}
