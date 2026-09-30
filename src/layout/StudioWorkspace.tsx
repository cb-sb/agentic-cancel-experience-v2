import { useEffect } from 'react'
import { EASE_ENTER, PANEL_MS } from '../lib/motion'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { BlankJourneyDoors } from '../orchestration/BlankJourneyDoors'
import { useCopilotStage } from '../orchestration/copilotStage'
import { DoorsBackdrop } from '../orchestration/OrchestrationCanvas'
import { PromptCodeDock } from '../orchestration/PromptCodeDock'
import { LibraryPanel } from '../orchestration/TemplatesModal'
import { V8 } from './layoutMode'
import { BackButton, backToExperiences } from '../shell/BackButton'
import { UploadFlow } from '../upload/UploadFlow'
import { UploadPage } from '../upload/UploadPage'
import { useUpload } from '../upload/useUpload'
import { activeKind, useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { CancelPageSettings } from './CancelPageSettings'
import { ExperiencesHome } from './ExperiencesHome'
import { ExperiencesIndex } from './ExperiencesIndex'
import { ExperiencesPane } from './ExperiencesPane'
import { SearchDialog } from './SearchDialog'
import { SIDEBAR_FOLDED_W, SIDEBAR_W } from './ThreadSidebar'
import { ReopenPane, TabbedPane, usePaneShown } from './ThreadWorkspace'
import { LibraryPage } from '../library/LibraryPage'
import { PlayOrder } from '../plays/PlayOrder'
import { PlayWorkspace } from '../plays/PlayWorkspace'
import { ToastHost } from '../plays/ui'

function ThreadView() {
  const stage = useCopilotStage()
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const paneShown = usePaneShown()
  const uploadPage = useUpload((s) => V8 && s.phase !== 'closed' && !s.mappingOnly)

  if (uploadPage) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1">
        <UploadPage />
      </div>
    )
  }

  if (templatesOpen) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1">
        <LibraryPanel page />
      </div>
    )
  }

  if (stage === 'doors') {
    return (
      <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-100">
        <DoorsBackdrop />
        <BlankJourneyDoors />
        <div className="absolute left-[16px] top-[14px] z-30">
          <BackButton fallback={backToExperiences} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      {V8 && paneShown && <TabbedPane />}
      <div
        className={`relative flex min-h-0 flex-col bg-white ${
          paneShown
            ? `w-[clamp(360px,32%,500px)] flex-none border-slate-200 ${V8 ? 'border-l' : 'border-r'}`
            : 'min-w-0 flex-1'
        }`}
      >
        <div className="flex h-full min-h-0">
          <PromptCodeDock centered railRight={V8 && paneShown} />
        </div>
        {!paneShown && <ReopenPane />}
      </div>
      {!V8 && paneShown && <TabbedPane />}
    </div>
  )
}

/**
 * V7: the Growth nav, then this experience's pane, then either the Experiences
 * page or the open experience (doors, then Copilot beside the tabs: on their
 * right in v8, on their left in v7).
 */
export function StudioWorkspace() {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const page = useWorkspaceUi((s) => s.page)
  const beatAsk = useWorkspaceUi((s) => s.beatAsk)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const focusTarget = useOrchestration((s) => s.focusTarget)
  const activeTab = useWorkspaceUi((s) => activeKind(s.tabs))
  const stepCount = useExperience((s) => s.experiences[PRIMARY_EXPERIENCE_ID]?.steps.length ?? 0)
  const stage = useCopilotStage()
  const paneShown = usePaneShown()
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const editorShown = page === 'thread' && !templatesOpen && paneShown && activeTab === 'editor'

  useEffect(() => {
    if (stage === 'rail') setAssistantOpen(true)
  }, [stage, setAssistantOpen])

  useEffect(() => {
    if (!editorShown || focusTarget || stepCount === 0) return
    useOrchestration.getState().enterWorkEditor()
  }, [editorShown, focusTarget, stepCount])

  useEffect(() => {
    if (beatAsk) useWorkspaceUi.getState().setPage('thread')
  }, [beatAsk])

  return (
    <div
      className="grid h-full min-h-0 bg-white motion-reduce:transition-none"
      style={{
        gridTemplateColumns: `${sidebarOpen ? SIDEBAR_W : SIDEBAR_FOLDED_W}px minmax(0,1fr)`,
        transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
      }}
    >
      <ExperiencesPane />
      <div className="flex min-h-0 min-w-0">
        {page === 'index' ? (
          <div className="min-w-0 flex-1">
            {V8 ? <ExperiencesHome /> : <ExperiencesIndex />}
          </div>
        ) : V8 && page === 'play' ? (
          <PlayWorkspace />
        ) : V8 && page === 'order' ? (
          <PlayOrder />
        ) : V8 && page === 'library' ? (
          <LibraryPage />
        ) : (
          <ThreadView />
        )}
      </div>
      {V8 && <ToastHost />}
      <UploadFlow />
      <CancelPageSettings />
      <SearchDialog />
    </div>
  )
}
