import { SButton } from '@chargebee/sting-react'
import { useExperience } from '../store/useExperience'
import { saveDraft } from '../store/draft'
import { useOrchestration } from '../store/useOrchestration'
import { useJourney } from '../store/useJourney'
import { StepNavBar } from './StepNavBar'
import { useUpload } from '../upload/useUpload'
import { canPublishUploaded, manifestErrors } from '../upload/validate'
import { useSetupProgress } from './JourneySetupChrome'

/**
 * The play's mode switch, and nothing else.
 *
 * Audience and Targeting were here, which put two settings decided once beside
 * the switch used constantly, and made them reachable from a preview where they
 * mean nothing at all. They are now a rail on the canvas edge, next to the play
 * they configure, and this is one radio group again: two buttons, one true.
 */
function PlayToolbar() {
  const mode = useExperience((s) => s.mode)
  const setMode = useExperience((s) => s.setMode)
  const previewing = mode === 'play'

  return (
    <div
      role="radiogroup"
      aria-label="Mode"
      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
    >
      {(['compose', 'play'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          onClick={() => {
            if (m === 'play') useOrchestration.getState().setWalkedOrSkipped(true)
            setMode(m)
          }}
          aria-checked={previewing === (m === 'play')}
          className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            previewing === (m === 'play')
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {m === 'compose' ? 'Build' : 'Preview'}
        </button>
      ))}
    </div>
  )
}

/**
 * `Save draft`, and what it last did.
 *
 * The badge beside it has said `Draft` since the first commit while everything
 * lived in memory, so a reload threw the draft away. The button is what makes
 * the badge true; the line under it is how you know it worked, and it is the
 * one place the prototype admits there is unsaved work.
 */
function SaveDraft() {
  const dirty = useOrchestration((s) => s.dirty)
  const savedAt = useOrchestration((s) => s.savedAt)

  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[11px] font-semibold text-slate-400">
        {dirty ? 'Unsaved changes' : savedAt ? `Saved ${sinceLabel(savedAt)}` : 'Nothing to save'}
      </span>
      <SButton size="small" variant="neutral-outline" disabled={!dirty} onClick={saveDraft}>
        Save draft
      </SButton>
    </div>
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

  const onPublish = () => {
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
        disabled={uploadedBlocked && !live}
        title={why}
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
 * The header while building: mode and lifecycle, nothing else.
 *
 * Preview is a wash over the canvas rather than a second header. Close lives
 * on that wash; this bar stays the play's — identity, mode, and publish.
 */
export function PlayHeader() {
  const uploaded = useJourney((s) => s.file.source === 'uploaded')
  const openRemap = useUpload((s) => s.openRemap)

  return (
    <>
      <header className="flex h-14 flex-none items-center justify-between gap-4 border-b border-slate-200 bg-white px-5">
        <PlayIdentity />
        <PlayToolbar />
        <div className="flex flex-none items-center gap-2">
          {uploaded && (
            <SButton size="small" variant="neutral-outline" onClick={openRemap}>
              Remap slots
            </SButton>
          )}
          <SaveDraft />
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <PublishControls />
        </div>
      </header>
      <StepNavBar />
    </>
  )
}
