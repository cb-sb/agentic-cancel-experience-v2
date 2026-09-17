import { create } from 'zustand'
import { useJourney } from '../store/useJourney'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { journeyFromUpload } from './apply'
import { bumpArtifactVersion, filesToArtifact, scanArtifact } from './scan'
import { EMPTY_JOURNEY } from '../journey/types'
import { composedDemoArtifact } from './kit'
import type { ContractIssue, TemplateArtifact, TemplateManifest } from './types'
import { contractErrors } from './validate'

export type UploadPhase = 'closed' | 'pick' | 'confirm'

interface UploadState {
  phase: UploadPhase
  mappingOnly: boolean
  artifact: TemplateArtifact | null
  manifest: TemplateManifest | null
  error: string | null
  checklist: ContractIssue[]
  open: () => void
  openRemap: () => void
  close: () => void
  backToPick: () => void
  loadFiles: (files: FileList | File[]) => Promise<void>
  loadSample: () => void
  setManifest: (manifest: TemplateManifest) => void
  confirm: () => void
}

function toArray(files: FileList | File[]): File[] {
  return Array.from(files as ArrayLike<File>)
}

function acceptScan(artifact: TemplateArtifact, manifest: TemplateManifest) {
  const errors = contractErrors(manifest)
  if (errors.length > 0) {
    return {
      phase: 'pick' as const,
      mappingOnly: false,
      artifact: null,
      manifest: null,
      checklist: errors,
      error: null,
    }
  }
  return {
    phase: 'confirm' as const,
    mappingOnly: false,
    artifact,
    manifest,
    checklist: [] as ContractIssue[],
    error: null,
  }
}

export const useUpload = create<UploadState>((set, get) => ({
  phase: 'closed',
  mappingOnly: false,
  artifact: null,
  manifest: null,
  error: null,
  checklist: [],

  open: () => set({ phase: 'pick', mappingOnly: false, error: null, checklist: [] }),

  openRemap: () => {
    const file = useJourney.getState().file
    if (file.source !== 'uploaded' || !file.artifact || !file.manifest) {
      set({ phase: 'pick', mappingOnly: false, error: null, checklist: [] })
      return
    }
    set({
      phase: 'confirm',
      mappingOnly: true,
      artifact: file.artifact,
      manifest: { ...file.manifest, confirmed: false },
      error: null,
      checklist: [],
    })
  },

  close: () =>
    set({
      phase: 'closed',
      mappingOnly: false,
      artifact: null,
      manifest: null,
      error: null,
      checklist: [],
    }),

  backToPick: () => set({ phase: 'pick', mappingOnly: false, error: null, checklist: [] }),

  loadFiles: async (input) => {
    set({ error: null })
    try {
      const prev = useJourney.getState().file.artifact
      const artifact = bumpArtifactVersion(prev, await filesToArtifact(toArray(input)))
      set(acceptScan(artifact, scanArtifact(artifact)))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not read that file.', checklist: [] })
    }
  },

  loadSample: () => {
    const prev = useJourney.getState().file.artifact
    const artifact = bumpArtifactVersion(prev, composedDemoArtifact())
    set(acceptScan(artifact, scanArtifact(artifact)))
  },

  setManifest: (manifest) => set({ manifest }),

  confirm: () => {
    const { artifact, manifest } = get()
    if (!artifact || !manifest) return
    if (contractErrors(manifest).length > 0) return
    const base = useJourney.getState().file
    const givenName = !base.name || base.name === EMPTY_JOURNEY.name ? undefined : base.name
    const saved = useMerchantLibrary.getState().saveFromUpload(artifact, manifest, givenName)
    const catalog = useMerchantLibrary.getState().components
    const components = saved.componentIds
      .map((id) => catalog.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c != null)
    const next = journeyFromUpload(base, artifact, saved.manifest, components)
    useJourney.getState().replaceFile({ ...next, name: saved.name })
    set({
      phase: 'closed',
      mappingOnly: false,
      artifact: null,
      manifest: null,
      error: null,
      checklist: [],
    })
  },
}))
