import { create } from 'zustand'
import { useJourney } from '../store/useJourney'
import { journeyFromUpload } from './apply'
import { bumpArtifactVersion, filesToArtifact, scanArtifact } from './scan'
import { sampleSingleArtifact, sampleZipArtifact } from './samples'
import type { TemplateArtifact, TemplateManifest } from './types'

export type UploadPhase = 'closed' | 'pick' | 'confirm'

interface UploadState {
  phase: UploadPhase
  mappingOnly: boolean
  artifact: TemplateArtifact | null
  manifest: TemplateManifest | null
  error: string | null
  open: () => void
  openRemap: () => void
  close: () => void
  backToPick: () => void
  loadFiles: (files: FileList | File[]) => Promise<void>
  loadSample: (kind: 'html' | 'zip') => void
  setManifest: (manifest: TemplateManifest) => void
  confirm: () => void
}

function toArray(files: FileList | File[]): File[] {
  return Array.from(files as ArrayLike<File>)
}

export const useUpload = create<UploadState>((set, get) => ({
  phase: 'closed',
  mappingOnly: false,
  artifact: null,
  manifest: null,
  error: null,

  open: () => set({ phase: 'pick', mappingOnly: false, error: null }),

  openRemap: () => {
    const file = useJourney.getState().file
    if (file.source !== 'uploaded' || !file.artifact || !file.manifest) {
      set({ phase: 'pick', mappingOnly: false, error: null })
      return
    }
    set({
      phase: 'confirm',
      mappingOnly: true,
      artifact: file.artifact,
      manifest: { ...file.manifest, confirmed: false },
      error: null,
    })
  },

  close: () =>
    set({ phase: 'closed', mappingOnly: false, artifact: null, manifest: null, error: null }),

  backToPick: () => set({ phase: 'pick', mappingOnly: false, error: null }),

  loadFiles: async (input) => {
    set({ error: null })
    try {
      const prev = useJourney.getState().file.artifact
      const artifact = bumpArtifactVersion(prev, await filesToArtifact(toArray(input)))
      const manifest = scanArtifact(artifact)
      set({ artifact, manifest, phase: 'confirm', mappingOnly: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not read that file.' })
    }
  },

  loadSample: (kind) => {
    const prev = useJourney.getState().file.artifact
    const artifact = bumpArtifactVersion(prev, kind === 'zip' ? sampleZipArtifact() : sampleSingleArtifact())
    const manifest = scanArtifact(artifact)
    set({ artifact, manifest, phase: 'confirm', mappingOnly: false, error: null })
  },

  setManifest: (manifest) => set({ manifest }),

  confirm: () => {
    const { artifact, manifest } = get()
    if (!artifact || !manifest) return
    const base = useJourney.getState().file
    useJourney.getState().replaceFile(journeyFromUpload(base, artifact, manifest))
    set({ phase: 'closed', mappingOnly: false, artifact: null, manifest: null, error: null })
  },
}))
