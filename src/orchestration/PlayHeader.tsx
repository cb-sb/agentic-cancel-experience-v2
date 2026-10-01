import type { ReactNode } from 'react'
import { SButton } from '@chargebee/sting-react'
import { useExperience } from '../store/useExperience'
import { saveDraft } from '../store/draft'
import { useOrchestration } from '../store/useOrchestration'
import { useJourney } from '../store/useJourney'
import { useUpload } from '../upload/useUpload'
import { canPublishUploaded, manifestErrors } from '../upload/validate'
import { V8 } from '../layout/layoutMode'
import { experienceChecks, failing } from '../setup/checks'
import { useSetupInputs } from '../setup/progress'
import { useWorkspace } from '../workspace/useWorkspace'
import { useSetupProgress } from './JourneySetupChrome'
import { SpotlightFrame } from './SpotlightFrame'

/**
 * Editor is the working surface. Canvas is the big picture. Preview opens on top.
 */
function SurfaceSwitch() {
  const surface = useOrchestration((s) => s.workSurface)
  const setWorkSurface = useOrchestration((s) => s.setWorkSurface)
  const mode = useExperience((s) => s.mode)
  const setMode = useExperience((s) => s.setMode)
  const previewing = mode === 'play'

  const go = (next: 'editor' | 'canvas' | 'preview') => {
    if (next === 'preview') {
      useOrchestration.getState().setWalkedOrSkipped(true)
      setMode('play')
      return
    }
    setMode('compose')
    setWorkSurface(next)
  }

  const item = (id: 'editor' | 'canvas' | 'preview', label: string) => {
    const pressed = id === 'preview' ? previewing : !previewing && surface === id
    const button = (
      <button
        type="button"
        role="radio"
        aria-checked={pressed}
        onClick={() => go(id)}
        className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
          pressed ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {label}
      </button>
    )
    return id === 'preview' ? (
      <SpotlightFrame key={id} id="walk" label="">
        {button}
      </SpotlightFrame>
    ) : (
      <span key={id}>{button}</span>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="Surface"
      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
    >
      {item('editor', 'Editor')}
      {item('preview', 'Preview')}
      {item('canvas', 'Canvas')}
    </div>
  )
}

/**
 * `Save draft`, and what it last did.
 *
 * When the file is clean, only the timestamp shows — a disabled Save button
 * next to “Saved just now” and a Draft badge is three statuses for one fact.
 */
function SaveDraft() {
  const dirty = useOrchestration((s) => s.dirty)
  const savedAt = useOrchestration((s) => s.savedAt)

  if (!dirty) {
    if (!savedAt) return null
    return (
      <span className="whitespace-nowrap text-[12px] text-slate-400">Saved {sinceLabel(savedAt)}</span>
    )
  }

  return (
    <SButton size="small" variant="neutral-outline" onClick={saveDraft}>
      Save draft
    </SButton>
  )
}

/** Coarse on purpose: the exact second a draft was written is never the question. */
function sinceLabel(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

/**
 * Publish state and the button that changes it — the one thing both headers
 * carry, because it is true of the play regardless of what you are doing to it.
 */
export function PublishControls() {
  const publishState = useOrchestration((s) => s.play.publishState)
  const togglePublish = useOrchestration((s) => s.togglePublish)
  const publishGapsOpen = useOrchestration((s) => s.publishGapsOpen)
  const setPublishGapsOpen = useOrchestration((s) => s.setPublishGapsOpen)
  const file = useJourney((s) => s.file)
  const live = publishState === 'live'
  const uploadedBlocked = file.source === 'uploaded' && !canPublishUploaded(file.manifest)
  const why = uploadedBlocked ? manifestErrors(file.manifest)[0] : undefined
  const progress = useSetupProgress()
  const inputs = useSetupInputs()
  const activeId = useWorkspace((s) => s.activeId)
  const open = V8 && !live ? failing(experienceChecks(activeId, inputs)) : []
  const checksBlocked = open.length > 0

  const onPublish = () => {
    if (V8) return togglePublish()
    if (!live && !progress.ready && !publishGapsOpen) {
      setPublishGapsOpen(true)
      return
    }
    setPublishGapsOpen(false)
    togglePublish()
  }

  return (
    <div className="relative flex items-center gap-2">
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
          live ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {live ? 'Live' : 'Draft'}
      </span>
      <SButton
        size="small"
        variant="primary"
        disabled={(uploadedBlocked && !live) || checksBlocked}
        title={checksBlocked ? `Still to pass: ${open.map((c) => c.label).join('. ')}` : why}
        onClick={onPublish}
      >
        {live ? 'Unpublish' : publishGapsOpen ? 'Publish anyway' : 'Publish'}
      </SButton>
      {publishGapsOpen && !live && progress.gaps.length > 0 && (
        <div className="absolute right-0 top-full z-40 mt-ti w-[320px] rounded-xl border border-amber-200 bg-amber-50 px-st py-st text-[12px] leading-relaxed text-amber-900 shadow-lg">
          Still open: {progress.gaps.join(' · ')}. You can publish anyway in this prototype.
        </div>
      )}
    </div>
  )
}

/** The play, named — the left end of both headers. */
export function PlayIdentity() {
  const play = useOrchestration((s) => s.play)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
        C
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-900">{play.name}</div>
        <div className="truncate text-[11px] capitalize text-slate-400">
          {play.presentation.replace(/_/g, ' ')} · priority {play.priority} ·{' '}
          {play.playType.replace(/_/g, ' ').toLowerCase()}
        </div>
      </div>
    </div>
  )
}

/**
 * The header on the right-hand surface: which view is open, and publish.
 *
 * Preview covers that surface. Close lives on the wash.
 */
export function PlayHeader({ trailing }: { trailing?: ReactNode } = {}) {
  return (
    <header className="grid h-14 flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-slate-200 bg-white px-5">
      <PlayIdentity />
      <SurfaceSwitch />
      <div className="flex min-w-0 items-center justify-end gap-[12px]">
        <PlayActions />
        {trailing}
      </div>
    </header>
  )
}

/** Remap, save, and publish: the right end of every work-surface header. */
export function PlayActions() {
  const uploaded = useJourney((s) => s.file.source === 'uploaded')
  const openRemap = useUpload((s) => s.openRemap)
  return (
    <>
      {uploaded && (
        <SButton size="small" variant="neutral-ghost" onClick={openRemap}>
          Remap slots
        </SButton>
      )}
      <SaveDraft />
      <span className="h-5 w-px flex-none bg-slate-200" aria-hidden />
      <PublishControls />
    </>
  )
}
